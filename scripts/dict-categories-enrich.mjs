// scripts/dict-categories-enrich.mjs
//
// dictionary_categories.name_ko AI 자동 번역 (H3 472 항목 sprint 용).
// Opus 4.7 + prompt caching (system 부분만 cache → batch 호출 시 비용 ↓).
//
// 입력  : Supabase 에서 name_ko IS NULL 행 직접 fetch (또는 --in JSON)
// 출력  : data/dict-categories/h{N}-enriched.json (dict-categories-update.mjs 호환)
// 적용  : 별도 단계 — node scripts/dict-categories-update.mjs <output> --dry-run
//         → 검토 후 --force 없이 적용 (멱등 — NULL 행만)
//
// CLI:
//   node scripts/dict-categories-enrich.mjs --level 3
//   node scripts/dict-categories-enrich.mjs --level 3 --batch 50
//   node scripts/dict-categories-enrich.mjs --level 3 --limit 100   # 작게 테스트
//   node scripts/dict-categories-enrich.mjs --in todo.json --out done.json
//
// 비용 추정 (H3 472 + batch=50):
//   - 10 batch 호출 · system prompt 1회 캐시 → 약 0.5~1$ (Opus 4.7)
//
// 안전 장치:
//   - Supabase 직접 UPDATE X — 항상 JSON 파일로만 출력
//   - 적용은 dict-categories-update.mjs 가 WHERE name_ko IS NULL 멱등 보장

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { argv, cwd, exit } from 'node:process'

import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

import { arg, makeClient } from './dict-common.mjs'

// .env.local — Anthropic 키는 보통 apps/web/.env.local 에 위치
dotenv.config({ path: resolve(cwd(), '.env.local'), override: false })
dotenv.config({ path: resolve(cwd(), 'apps/web/.env.local'), override: false })

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_KEY) {
  console.error('  ✗ ANTHROPIC_API_KEY 누락 — .env.local 확인')
  exit(1)
}

const MODEL = 'claude-opus-4-7'
const MAX_TOKENS = 4000

const level = arg(argv, '--level')
const batchSize = parseInt(arg(argv, '--batch', '50'), 10)
const limit = parseInt(arg(argv, '--limit', '500'), 10)
const inPath = arg(argv, '--in')
const outPath = arg(argv, '--out', `data/dict-categories/h${level ?? 'X'}-enriched.json`)

// ── 1. 입력 수집 ──────────────────────────────────────
let items
if (inPath) {
  const raw = readFileSync(resolve(cwd(), inPath), 'utf8')
  const json = JSON.parse(raw)
  items = Array.isArray(json) ? json : (json.items ?? [])
  console.log(`  · ${items.length} rows from ${inPath}`)
} else {
  const supabase = makeClient()
  let q = supabase
    .from('dictionary_categories')
    .select('id, name_en, level, parent_id, cover_emoji')
    .is('name_ko', null)
    .order('level', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)
  if (level) q = q.eq('level', parseInt(level, 10))
  const { data, error } = await q
  if (error) {
    console.error('  ✗ Supabase fetch 실패:', error.message)
    exit(1)
  }
  items = data ?? []
  console.log(`  · ${items.length} rows fetched (level=${level ?? 'all'}, limit=${limit})`)
}

if (items.length === 0) {
  console.log('  · 처리할 행이 없습니다 — 모두 채워짐.')
  exit(0)
}

// ── 2. parent 맥락 lookup (level≥2 의 경우 부모 name_en/name_ko 노출) ──
const supabase = makeClient()
const parentIds = [...new Set(items.map((i) => i.parent_id).filter(Boolean))]
let parentMap = new Map()
if (parentIds.length > 0) {
  const { data: parents, error: pErr } = await supabase
    .from('dictionary_categories')
    .select('id, name_en, name_ko')
    .in('id', parentIds)
  if (pErr) {
    console.error('  ✗ parent lookup 실패:', pErr.message)
    exit(1)
  }
  parentMap = new Map(parents.map((p) => [p.id, p]))
}

// ── 3. Anthropic 호출 (prompt caching) ─────────────────
const client = new Anthropic({ apiKey: ANTHROPIC_KEY })

const SYSTEM_PROMPT = `당신은 한국 영어 학습자를 위한 어휘 카테고리 분류 편찬가입니다.

입력으로 영어 카테고리명 + 부모 카테고리 맥락을 받습니다. 각 카테고리의 한국어 이름을 작성하세요.

규칙:
- 자연스러운 현대 한국어 (학습자 친화)
- 부모 카테고리 의미 정합 — 예: parent='음식과 음료', name_en='Drinks' → '음료'
- 영문 "and" 처리: 짧은 쌍은 "와/과", 3+ 항목은 가운데점 "·"
  예: "Fish and shellfish" → "물고기와 조개류"
  예: "Phones, email and the internet" → "전화·이메일·인터넷"
- 정관사 "the" 는 생략 — "the environment" → "환경"
- 약어/단위는 한국어 통용 형식 — "TV/radio" 그대로, "Maths" → "수학"
- 전치사구·동명사는 명사화 — "Achieving success" → "성공 달성"
- 부모와 동일 단어 충돌 방지 — parent='동물', name_en='Animals' → '동물 일반'
- 한 카테고리당 5~12자 권장 (UI list 가독성)
- 이미 광범위한 한국어 학계 용어가 있으면 그대로 사용 (예: '광합성', '회로 이론')

출력 형식: 입력 1개당 1줄 JSON (JSONL):
{"id":"...","name_ko":"..."}
주석/마크다운/코드펜스 절대 추가 금지. JSONL 외 텍스트 출력 X.`

async function enrichBatch(batch) {
  const userInput = batch
    .map((it) => {
      const parent = it.parent_id ? parentMap.get(it.parent_id) : null
      const parentHint = parent
        ? ` (parent: "${parent.name_en}" / "${parent.name_ko ?? '?'}")`
        : ''
      return JSON.stringify({
        id: it.id,
        name_en: it.name_en,
        level: it.level,
        parent_hint: parentHint.trim(),
      })
    })
    .join('\n')

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `다음 카테고리들의 한국어 이름을 JSONL 로 출력하세요. 각 줄은 {"id":"...","name_ko":"..."} 형식.\n\n${userInput}`,
      },
    ],
  })

  const text = resp.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')

  const out = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.id && parsed.name_ko) out.push(parsed)
    } catch {
      console.warn(`    ⚠ JSON 파싱 실패 — 건너뜀: ${trimmed.slice(0, 60)}…`)
    }
  }

  return {
    items: out,
    usage: resp.usage,
  }
}

// ── 4. batch 루프 ─────────────────────────────────────
const results = []
let totalInput = 0
let totalOutput = 0
let totalCacheRead = 0
let totalCacheCreate = 0

const batchCount = Math.ceil(items.length / batchSize)
for (let i = 0; i < items.length; i += batchSize) {
  const batchIdx = Math.floor(i / batchSize) + 1
  const batch = items.slice(i, i + batchSize)
  process.stdout.write(`  · batch ${batchIdx}/${batchCount} (${batch.length} rows)... `)
  try {
    const { items: enriched, usage } = await enrichBatch(batch)
    results.push(...enriched)
    totalInput += usage.input_tokens
    totalOutput += usage.output_tokens
    totalCacheRead += usage.cache_read_input_tokens ?? 0
    totalCacheCreate += usage.cache_creation_input_tokens ?? 0
    console.log(
      `✓ ${enriched.length}/${batch.length} · in=${usage.input_tokens} out=${usage.output_tokens} cache_r=${usage.cache_read_input_tokens ?? 0}`,
    )
  } catch (e) {
    console.error(`✗ ${e.message}`)
  }
}

// ── 5. 출력 ───────────────────────────────────────────
const outAbs = resolve(cwd(), outPath)
mkdirSync(dirname(outAbs), { recursive: true })

const payload = {
  generated_at: new Date().toISOString(),
  source: 'ai_enriched_opus-4-7',
  level: level ?? 'all',
  count: results.length,
  items: results.map((r) => ({
    id: r.id,
    name_ko: r.name_ko,
    ...(r.cover_emoji ? { cover_emoji: r.cover_emoji } : {}),
  })),
}

writeFileSync(outAbs, JSON.stringify(payload, null, 2) + '\n', 'utf8')

console.log('━'.repeat(50))
console.log(`  ✓ ${results.length}/${items.length} enriched → ${outAbs}`)
console.log(
  `  · tokens: in=${totalInput} out=${totalOutput} cache_read=${totalCacheRead} cache_create=${totalCacheCreate}`,
)
// Opus 4.7 가격 (2026-05 기준 추정): input $15/M · output $75/M · cache_read $1.5/M · cache_create $18.75/M
const costEst =
  (totalInput / 1_000_000) * 15 +
  (totalOutput / 1_000_000) * 75 +
  (totalCacheRead / 1_000_000) * 1.5 +
  (totalCacheCreate / 1_000_000) * 18.75
console.log(`  · 추정 비용: ~$${costEst.toFixed(3)}`)
console.log('')
console.log(`  다음:`)
console.log(`    node scripts/dict-categories-update.mjs ${outPath} --dry-run`)
console.log(`    node scripts/dict-categories-update.mjs ${outPath}`)
