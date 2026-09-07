// scripts/lexicon/oov-orphan-import.ts
//
// Phase 3 OOV/orphan enrichment — enriched 데이터 적용.
//
// 입력: data/lexicon/p3-oov-orphan/enriched.jsonl
//   각 라인 schema (P5 패턴 정합):
//   {
//     "word": "...",
//     "pos": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|determiner|interjection|idiom|phrasal_verb",
//     "meaning_ko": "...",
//     "meanings_ko": [{"pos":"...","meaning":"..."}],   // optional, defaults to single sense
//     "example_en": "...",
//     "ipa": "/.../",
//     "synonyms": [...],
//     "antonyms": [...],
//     "cefr_level": "A1..C2",
//     "korean_learner_note": "..."|null
//   }
//
// 동작:
//   1. UPDATE kice-orphan rows  — ipa / cefr_level / example_en (NULL 인 필드만)
//                                   meaning_ko, pos, primary_pos, meanings_ko 보존
//   2. INSERT OOV new rows       — source='ai-generated', senses[]+pos_set 계산
//                                   ON CONFLICT (word) DO NOTHING (멱등)
//   3. Lemma backfill            — shared_words/vocabularies (Step 8 패턴)
//                                   library_book_vocabularies / library_article_vocabularies
//
// CLI:
//   tsx scripts/lexicon/oov-orphan-import.ts          (dry-run, 기본)
//   tsx scripts/lexicon/oov-orphan-import.ts --apply  (실제 적용)

import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

// @ts-expect-error — .mjs 공통 게이트(타입 선언 없음). scripts/dict/headword-gate.mjs
import { gateHeadwords, writeHold } from '../dict/headword-gate.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const INPUT_DIR = resolve(__dirname, '../../data/lexicon/p3-oov-orphan')
const TARGETS_FILE = resolve(INPUT_DIR, 'targets.jsonl')
const ENRICHED_FILE = resolve(INPUT_DIR, 'enriched.jsonl')

interface EnrichedRow {
  word: string
  pos: string
  meaning_ko: string
  meanings_ko?: Array<{ pos: string; meaning: string }>
  example_en: string
  ipa: string
  synonyms?: string[]
  antonyms?: string[]
  cefr_level: string
  korean_learner_note?: string | null
}

interface TargetRow {
  action: 'update' | 'insert'
  source_group: 'kice-orphan' | 'oov'
  word: string
}

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes('--apply') }
}

function readJsonl<T>(path: string): T[] {
  const raw = fs.readFileSync(path, 'utf-8').trim()
  if (!raw) return []
  return raw.split(/\r?\n/).map((line) => JSON.parse(line) as T)
}

function buildSensesFromMeanings(
  meanings: EnrichedRow['meanings_ko'] | undefined,
  fallbackPos: string,
  fallbackMeaningKo: string,
  exampleEn: string | null,
): unknown[] {
  if (meanings && meanings.length > 0) {
    return meanings.map((m, i) => ({
      sense_idx: i,
      pos: m.pos ?? fallbackPos,
      sense_ko: m.meaning,
      sense_en: null,
      register: 'neutral',
      examples: i === 0 && exampleEn ? [{ en: exampleEn }] : [],
    }))
  }
  return [
    {
      sense_idx: 0,
      pos: fallbackPos,
      sense_ko: fallbackMeaningKo,
      sense_en: null,
      register: 'neutral',
      examples: exampleEn ? [{ en: exampleEn }] : [],
    },
  ]
}

function buildPosSet(senses: Array<{ pos: string }>): string[] {
  const set = new Set<string>()
  for (const s of senses) {
    if (s.pos) set.add(s.pos)
  }
  return [...set].sort()
}

async function applyOrphanUpdate(
  sb: SupabaseClient,
  enriched: EnrichedRow,
  apply: boolean,
): Promise<{ skipped: boolean; updated: number }> {
  // 채울 필드: ipa, cefr_level, example_en — 각각 IS NULL 인 경우에만
  const updates: Record<string, string | null> = {
    ipa: enriched.ipa,
    cefr_level: enriched.cefr_level,
    example_en: enriched.example_en,
  }

  if (!apply) {
    return { skipped: false, updated: 0 }
  }

  // 멱등성: NULL 인 필드만 채움. 하나씩 UPDATE (조건 다름).
  let updatedAny = 0
  for (const [field, value] of Object.entries(updates)) {
    if (value === null || value === undefined) continue
    const { error, count } = await sb
      .from('shared_dictionary')
      .update({ [field]: value, updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('word', enriched.word)
      .eq('source', 'kice-orphan')
      .is(field, null)
    if (error) throw error
    updatedAny += count ?? 0
  }
  return { skipped: false, updated: updatedAny }
}

async function applyOovInsert(
  sb: SupabaseClient,
  enriched: EnrichedRow,
  apply: boolean,
): Promise<{ skipped: boolean; inserted: boolean }> {
  const senses = buildSensesFromMeanings(
    enriched.meanings_ko,
    enriched.pos,
    enriched.meaning_ko,
    enriched.example_en ?? null,
  )
  const posSet = buildPosSet(senses as Array<{ pos: string }>)

  if (!apply) return { skipped: false, inserted: false }

  // INSERT ... ON CONFLICT DO NOTHING (멱등)
  const { error } = await sb.from('shared_dictionary').upsert(
    {
      word: enriched.word,
      pos: enriched.pos,
      primary_pos: enriched.pos,
      meaning_ko: enriched.meaning_ko,
      meanings_ko: enriched.meanings_ko ?? [{ pos: enriched.pos, meaning: enriched.meaning_ko }],
      example_en: enriched.example_en ?? null,
      ipa: enriched.ipa ?? null,
      cefr_level: enriched.cefr_level ?? null,
      source: 'ai-generated',
      senses,
      pos_set: posSet,
      inflections: { forms: [], source: 'ai-generated' },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'word', ignoreDuplicates: true },
  )
  if (error) throw error
  return { skipped: false, inserted: true }
}

async function lemmaBackfill(sb: SupabaseClient, apply: boolean): Promise<Record<string, number>> {
  if (!apply) return {}

  // shared_words / vocabularies / library_book_vocabularies / library_article_vocabularies
  // Step 8 패턴: lemma IS NULL && EXISTS sd WHERE sd.word = LOWER(TRIM(word))
  const tables: Array<{ name: string; wordCol: string }> = [
    { name: 'shared_words', wordCol: 'word' },
    { name: 'vocabularies', wordCol: 'word' },
    { name: 'library_book_vocabularies', wordCol: 'word' },
    { name: 'library_article_vocabularies', wordCol: 'word' },
  ]
  const result: Record<string, number> = {}

  for (const t of tables) {
    // supabase-js 는 raw UPDATE FROM 미지원 — RPC 또는 raw SQL 필요.
    // 단순 패턴: NULL row 단건씩 fetch → sd 매칭 → UPDATE. 대규모면 비효율이나 119건 한정 OK.
    const { data: nulls, error } = await sb
      .from(t.name)
      .select(`id, ${t.wordCol}`)
      .is('lemma', null)
      .not(t.wordCol, 'is', null)
      .limit(1000)
    if (error) {
      // 테이블 존재하지 않으면 skip
      if (error.code === '42P01' || /does not exist/i.test(error.message)) {
        result[t.name] = -1
        continue
      }
      throw error
    }

    let filled = 0
    for (const row of nulls ?? []) {
      const lemma = String((row as Record<string, unknown>)[t.wordCol] ?? '')
        .toLowerCase()
        .trim()
      if (!lemma) continue
      const { count } = await sb.from('shared_dictionary').select('word', { count: 'exact', head: true }).eq('word', lemma)
      if ((count ?? 0) === 0) continue
      const { error: upErr } = await sb
        .from(t.name)
        .update({ lemma })
        .eq('id', (row as { id: unknown }).id)
        .is('lemma', null)
      if (upErr) throw upErr
      filled += 1
    }
    result[t.name] = filled
  }
  return result
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE env required')
    process.exit(1)
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── 입력 로드 ──
  if (!fs.existsSync(TARGETS_FILE)) {
    console.error(`targets file missing: ${TARGETS_FILE}`)
    console.error('  → run: tsx scripts/lexicon/oov-orphan-extract.ts')
    process.exit(1)
  }
  if (!fs.existsSync(ENRICHED_FILE)) {
    console.error(`enriched file missing: ${ENRICHED_FILE}`)
    console.error('  → enrichment 파일을 먼저 생성하세요 (Claude API 또는 sub-agent 수행)')
    process.exit(1)
  }

  const targets = readJsonl<TargetRow>(TARGETS_FILE)
  const enriched = readJsonl<EnrichedRow>(ENRICHED_FILE)
  const targetByWord = new Map(targets.map((t) => [t.word, t]))
  const enrichedByWord = new Map(enriched.map((e) => [e.word, e]))

  const mode = opts.apply ? 'APPLY' : 'DRY-RUN'
  console.log(`[${mode}] targets=${targets.length}, enriched=${enriched.length}`)

  // ── 1:1 매칭 검증 ──
  const missingEnriched = targets.filter((t) => !enrichedByWord.has(t.word))
  const orphanedEnriched = enriched.filter((e) => !targetByWord.has(e.word))
  if (missingEnriched.length > 0) {
    console.error(`✗ ${missingEnriched.length} targets without enrichment:`)
    for (const t of missingEnriched.slice(0, 10)) console.error(`    ${t.word}`)
    process.exit(1)
  }
  if (orphanedEnriched.length > 0) {
    console.warn(`⚠ ${orphanedEnriched.length} enriched rows have no target (will be ignored):`)
    for (const e of orphanedEnriched.slice(0, 10)) console.warn(`    ${e.word}`)
  }

  // ── ⛔ 표제어 유효성 게이트 (2026-08-17) ──
  //   이 경로는 lbv/lav 미해소 토큰을 사전으로 승격시킨다 — **파편이 표제어가 되는 역류로**다.
  //   추출 단계를 고쳐도 여기로 들어오므로 INSERT 직전에 막는다.
  //   UPDATE(기존 표제어 보강)는 대상이 아니다 — 새 표제어를 만드는 INSERT 만 검사한다.
  //   공통 게이트: scripts/dict/headword-gate.mjs
  const insertWords = targets.filter((t) => t.action === 'insert').map((t) => t.word)
  const heldWords = new Set<string>()
  if (insertWords.length) {
    const { hold } = await gateHeadwords(sb, insertWords)
    for (const h of hold) heldWords.add(String(h.word).toLowerCase())
    if (hold.length) {
      const holdPath = resolve(__dirname, '../../data/lexicon/oov-orphan-import.hold.json')
      writeHold(fs, holdPath, hold, { script: 'oov-orphan-import', at: new Date().toISOString() })
      const by = hold.reduce<Record<string, number>>((m, h) => ((m[h.reason] = (m[h.reason] ?? 0) + 1), m), {})
      console.warn(`\n⛔ 표제어 게이트 보류 ${hold.length} ${JSON.stringify(by)} → ${holdPath}`)
      console.warn('   (자동 삭제 안 함 — 사람 검토 후 재실행)')
    }
  }

  // ── 적용 ──
  let orphanUpdated = 0
  let oovInserted = 0
  let oovHeld = 0
  for (const t of targets) {
    const e = enrichedByWord.get(t.word)
    if (!e) continue
    if (t.action === 'insert' && heldWords.has(String(t.word).toLowerCase())) { oovHeld += 1; continue }
    if (t.action === 'update') {
      const r = await applyOrphanUpdate(sb, e, opts.apply)
      orphanUpdated += r.updated
    } else if (t.action === 'insert') {
      const r = await applyOovInsert(sb, e, opts.apply)
      if (r.inserted) oovInserted += 1
    }
  }

  console.log(`\n=== Apply result (${mode}) ===`)
  console.log(`  kice-orphan UPDATE rows-affected: ${orphanUpdated}`)
  console.log(`  OOV INSERT executed:              ${oovInserted}`)
  console.log(`  OOV 표제어 게이트 보류:            ${oovHeld}`)

  // ── lemma backfill ──
  const backfill = await lemmaBackfill(sb, opts.apply)
  console.log(`\n=== Lemma backfill (${mode}) ===`)
  for (const [name, n] of Object.entries(backfill)) {
    console.log(`  ${name}: ${n === -1 ? '(table missing — skipped)' : `${n} rows filled`}`)
  }

  if (!opts.apply) {
    console.log('\n(dry-run — pass --apply to write)')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
