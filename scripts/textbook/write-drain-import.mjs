// scripts/textbook/write-drain-import.mjs
//
// **집필 드레인 ③/③ — Claude Code 가 쓴 지문을 `library_articles` 에 넣는다.**
//
// ── 넣고 나서 끝이 아니다 ────────────────────────────────────────────
// 적재된 글은 아직 **어휘도 밴드도 없다.** 이어서 두 가지를 돌려야 교재 재료가 된다:
//
//   1. `scripts/acp/reprocess.mjs --missing-vocab --commit`  어휘·CEFR·밴드 계산
//   2. `scripts/textbook/store-new-types.mjs --commit`        문항 생성
//
// 이 스크립트는 그 둘을 대신하지 않는다 — 적재와 분석을 한 스위치에 묶으면
// "무엇이 실패했는지" 를 알 수 없다.
//
// ── 넣지 않는 것 ─────────────────────────────────────────────────────
// 빈 값 · 너무 짧은 글 · 문장이 모자란 글은 **넣지 않는다.** 넣으면 다음 export 가
// "원글이 늘었다" 고 세는데 문항은 안 나와서 구멍이 영영 남는다. 건너뛴 수를 반드시 찍는다.
//
// 재실행 안전: `source_id` 가 유일키다(`original:v<밴드>-<슬롯>`). 이미 있으면 건너뛴다 —
// 몇 번 돌려도 결과가 같다. **덮어쓰지 않는다** — 이미 문항이 붙은 글의 본문을 바꾸면
// 그 문항들의 정답이 조용히 어긋난다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-import.mjs --band 3          (미리보기)
//   pnpm dlx tsx scripts/textbook/write-drain-import.mjs --band 3 --commit

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { loadEnv } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const BAND = Number(arg('band') ?? 3)
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

/**
 * 넣을 수 있는 글의 하한.
 *
 * `order` 문항은 도입문 + 세 덩어리를 만들어야 하고 `insert` 는 자리 다섯을 만들어야 한다.
 * **문장이 여섯 미만이면 둘 다 못 만든다** — 그런 글은 원글 수만 늘리고 단원은 못 늘린다.
 */
const MIN_SENTENCES = 6
const MIN_WORDS = 60

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
/** 문장 세기 — 마침표·물음표·느낌표 뒤 공백. 약어(Dr. 등)를 완벽히 가르지는 않는다(하한 판정용). */
const countSentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1).length

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const outFiles = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.out.json'))
  .sort()
if (!outFiles.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}

const rows = []
for (const f of outFiles) rows.push(...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
console.log(`청크 ${outFiles.length}개 · 지문 ${rows.length}편`)

// ── 거르기 ──────────────────────────────────────────────────────────
const skipped = []
const ok = []
const seenTitle = new Set()
for (const r of rows) {
  const title = String(r.title ?? '').trim()
  const content = String(r.content ?? '').trim()
  const words = content.split(/\s+/).filter(Boolean).length
  const sentences = countSentences(content)
  if (!title) skipped.push([r.slot, '제목이 비었다'])
  else if (!content) skipped.push([r.slot, '본문이 비었다'])
  else if (words < MIN_WORDS) skipped.push([r.slot, `${words}어 — ${MIN_WORDS}어 미만`])
  else if (sentences < MIN_SENTENCES) skipped.push([r.slot, `${sentences}문장 — ${MIN_SENTENCES}문장 미만이면 문항을 못 만든다`])
  else if (seenTitle.has(title.toLowerCase())) skipped.push([r.slot, '같은 청크 안에 제목이 겹친다'])
  else {
    seenTitle.add(title.toLowerCase())
    ok.push({ ...r, title, content, words, sentences })
  }
}
console.log(`  넣을 수 있는 것 ${ok.length} · **건너뛴 것 ${skipped.length}**`)
for (const [slot, why] of skipped) console.log(`    · 슬롯 ${slot}: ${why}`)

// ── 이미 있는 것 ────────────────────────────────────────────────────
const sourceIds = ok.map((r) => `original:v${BAND}-${r.slot}`)
const existing = new Set()
for (let i = 0; i < sourceIds.length; i += 50) {
  const { data, error } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'original')
    .in('source_id', sourceIds.slice(i, i + 50))
  if (error) throw new Error('중복 조회 실패: ' + error.message)
  for (const r of data ?? []) existing.add(r.source_id)
}
const fresh = ok.filter((r) => !existing.has(`original:v${BAND}-${r.slot}`))
console.log(`  이미 있음 ${ok.length - fresh.length} · **새로 넣을 것 ${fresh.length}**`)

if (!commit) {
  console.log('\n--commit 을 붙이면 적재한다.')
  process.exit(0)
}

// ── 배치를 먼저 만든다 ──────────────────────────────────────────────
//
// `chk_original_needs_batch` 가 `source='original'` 인 행에 `compose_batch_id` 와
// `composed_spec` 을 **둘 다** 요구한다. 우리가 쓴 글이 어디서 왔는지 추적할 수 없으면
// 나중에 "이 지문 출처가 뭐냐" 에 답할 수 없기 때문이다 — 우회할 이유가 없는 가드다.
//
// 그래서 드레인 실행마다 배치 한 행을 만들고 이번에 넣는 글을 거기 매단다.
// `status='done'` — 이 배치는 이미 다 쓰인 상태로 들어온다(수집 단계를 거치지 않는다).
const batchTopic = `교재 집필 드레인 V${BAND} — ${outFiles.length}청크 ${fresh.length}편`
const { data: batch, error: be } = await db
  .from('article_compose_batches')
  .insert({ topic: batchTopic, status: 'done' })
  .select('id')
  .single()
if (be) throw new Error('배치 생성 실패: ' + be.message)
console.log(`\n배치 ${batch.id} — ${batchTopic}`)

let inserted = 0
for (const r of fresh) {
  const { error } = await db.from('library_articles').insert({
    source: 'original',
    source_id: `original:v${BAND}-${r.slot}`,
    compose_batch_id: batch.id,
    source_url: '',
    title: r.title,
    language: 'en',
    // 창작물이다 — 시중 교재를 입력으로 쓰지 않았다.
    license: 'CC0-1.0 (Vocaflow Original)',
    copyright_safe_in_kr: true,
    content: r.content,
    content_hash: sha256(r.content),
    // ⚠️ `ready` 로 넣는다. **`published` 로 넣지 않는다** — 발행은 사람 판단이다.
    status: 'ready',
    display_only: false,
    llm_cost_usd: 0,
    composed_spec: {
      track: 'csat_korean',
      written_by: 'claude_code_drain',
      target_v_level: BAND,
      topic_axis: r.topic_axis ?? null,
      shape: r.shape ?? null,
      words_min: r.words_min ?? null,
      words_max: r.words_max ?? null,
    },
  })
  if (error) console.log(`  ✗ 슬롯 ${r.slot}: ${error.message}`)
  else inserted++
}

console.log(`\n적재 완료 ${inserted}편`)
console.log('이어서 돌릴 것:')
console.log('  1. pnpm dlx tsx scripts/acp/reprocess.mjs --missing-vocab --commit   (어휘·CEFR·밴드)')
console.log('  2. pnpm dlx tsx scripts/textbook/store-new-types.mjs --commit        (문항 생성)')
console.log('그 다음 write-drain-export 를 다시 돌려 **의도한 밴드에 떨어졌는지** 확인한다.')
