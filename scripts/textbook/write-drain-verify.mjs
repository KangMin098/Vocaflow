// scripts/textbook/write-drain-verify.mjs
//
// **집필 드레인 ②.5 — 저장한 지문이 목표 밴드에 떨어지는지 적재 *전에* 잰다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 조준은 어휘 지침만으로는 안 잡힌다. 실측(2026-08-21, 전부 V3 목표):
//
//   꼬리 0개   10편  적중 20%    평균 −0.40   ← 쉽게만 써서 아래로
//   꼬리 7~9개 52편  적중 13.5%  평균 +1.00   ← 과교정해서 위로
//   꼬리 4~5개 82편  적중 58%    평균 **+0.06**  ← 편향은 잡혔는데 **분산이 남았다**
//
// 편향이 0 에 가까운데 적중이 6할이라는 것은, 지침이 방향은 맞히지만 **한 편 한 편은
// 여전히 운에 맡겨진다**는 뜻이다. 원인은 세는 방법이다 — 집필하는 쪽은 `lexicon.json` 의
// **표본 목록과 문자열이 겹치는 낱말만** 셀 수 있는데, 실제 등급은 글에 쓰인 **모든** 낱말이
// 정한다. 목록 밖의 평범한 낱말이 조용히 꼬리에 들어간다(실측: `warm`·`surface`·`flat`·
// `thick` 이 V4, `coin`·`sweat` 이 V5).
//
// 그래서 짐작을 그만두고 **채점 경로를 그대로 재현해서 잰다** —
// `extractBookLemmas` → `shared_dictionary.v_level` → 75분위. `compute_article_vrl` 과 같은 방법이다.
//
// ⚠️ 이 스크립트는 **아무것도 고치지 않는다.** 어느 편이 어느 계단에 떨어질지 알려 줄 뿐이다.
//   고치는 것은 집필하는 쪽의 일이다 — 기계가 낱말을 바꾸면 글이 망가진다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-verify.mjs --band 3
//   pnpm dlx tsx scripts/textbook/write-drain-verify.mjs --band 3 --only chunk-02

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 3)
const ONLY = arg('only')
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

const { createClient } = await import('@supabase/supabase-js')
const { extractBookLemmas } = await import('@vocaflow/library-pipeline')

// ⚠️ **채점기와 한 글자도 다르면 안 된다.** 1차 검사기는 원시 추출어를 그대로 등급 매겼는데
//   `compute_article_vrl` 은 `library_article_vocabularies` 를 쓰고 **`v_level = 11` 을 뺀다.**
//   그 차이로 검사기가 실제보다 **낮게** 나왔고, 배치들이 검사기에 맞춰 어려운 낱말을 덜어내자
//   실제 배정이 위로 떠서 **적중률이 오히려 떨어졌다**(V3 58.5% → 44.0% · V2 75% → 70.6%).
//   검사기에 맞추는 것이 채점기에 맞추는 것과 달라지는 순간, 검사기는 도움이 아니라 함정이 된다.
const V_LEVEL_EXCLUDED = 11

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.out.json'))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort()
if (!files.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}

const rows = []
for (const f of files) {
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) rows.push({ ...r, file: f })
}

// ── 낱말 → 등급 ─────────────────────────────────────────────────────
// 채점기와 **같은 추출기**를 쓴다. 다른 토크나이저를 쓰면 여기서 통과한 글이 적재 뒤에 떨어진다.
// `analyzeArticle` 이 만드는 것과 **같은 낱말 집합**이어야 한다 — 그것이 그대로
// `library_article_vocabularies` 에 들어가고 채점기가 그 표를 읽는다.
const perDoc = rows.map((r) => {
  const content = String(r.content ?? '')
  const index = extractBookLemmas([
    {
      chapter_idx: 1,
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
      paragraph_offsets: [0],
      sentence_offsets: [0],
    },
  ])
  return { row: r, lemmas: [...index.bookFrequency.keys()] }
})
const allWords = [...new Set(perDoc.flatMap((d) => d.lemmas))]
const level = new Map()
for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', allWords, ['word'])) {
  // 채점기와 같이 **v11 을 뺀다.** 넣으면 검사기가 실제보다 높게 나오고, 빼먹으면 낮게 나온다.
  if (d.v_level != null && Number(d.v_level) !== V_LEVEL_EXCLUDED) level.set(d.word, Number(d.v_level))
}

/** `PERCENTILE_DISC(0.75)` — 정렬한 값 중 누적 비율이 0.75 를 처음 넘는 값. */
const p = (sorted, q) => {
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)
  return sorted[Math.max(0, i)]
}

const line = '─'.repeat(78)
console.log(`V${BAND} 목표 — 청크 ${files.length}개 · 지문 ${rows.length}편\n`)
console.log(['  ', '슬롯'.padEnd(6), 'p50'.padEnd(5), 'p75'.padEnd(5), 'p90'.padEnd(5), '적중낱말'.padEnd(9), '꼬리'.padEnd(5), '제목'].join(' '))
console.log(line)

let hit = 0
const off = []
for (const { row, lemmas } of perDoc) {
  const levels = lemmas.map((w) => level.get(w)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  const p75 = p(levels, 0.75)
  const tail = levels.filter((n) => n > BAND).length
  const ok = p75 === BAND
  if (ok) hit++
  else off.push({ slot: row.slot, p75, tail, title: row.title })
  console.log(
    [
      ok ? '✅' : p75 == null ? '❓' : p75 < BAND ? '⬇ ' : '⬆ ',
      String(row.slot).padEnd(6),
      String(p(levels, 0.5) ?? '-').padEnd(5),
      String(p75 ?? '-').padEnd(5),
      String(p(levels, 0.9) ?? '-').padEnd(5),
      String(levels.length).padEnd(9),
      String(tail).padEnd(5),
      String(row.title ?? '').slice(0, 34),
    ].join(' '),
  )
}

console.log(line)
console.log(`\n**목표 V${BAND} 적중 ${hit}/${rows.length}**  = ${((100 * hit) / rows.length).toFixed(1)}%`)
if (off.length) {
  const up = off.filter((o) => o.p75 > BAND)
  const down = off.filter((o) => o.p75 < BAND)
  console.log(`  위로 ${up.length} · 아래로 ${down.length}`)
  console.log(`\n  고칠 곳 — **낱말을 바꾸는 것은 집필하는 쪽의 일이다.** 여기서는 방향만 말한다:`)
  for (const o of up) console.log(`    ⬆  슬롯 ${o.slot} (p75 ${o.p75}, 꼬리 ${o.tail}) — 어려운 낱말을 줄인다: ${String(o.title).slice(0, 40)}`)
  for (const o of down) console.log(`    ⬇  슬롯 ${o.slot} (p75 ${o.p75}, 꼬리 ${o.tail}) — 어려운 낱말을 늘린다: ${String(o.title).slice(0, 40)}`)
  console.log(`\n  고친 뒤 이 스크립트를 다시 돌린다. 적중이 안 되는 편은 적재해도 다른 계단에 쌓일 뿐이다`)
  console.log(`  (버리지는 않는다 — 아래 계단도 비어 있다).`)
}
