// scripts/textbook/write-drain-tailwords.mjs
//
// **집필 드레인 ②.6 — 꼬리가 *어느 낱말*인지 이름으로 말한다.**
//
// ── 왜 필요한가 (2026-08-30 실측) ────────────────────────────────────
// `write-drain-verify.mjs` 는 "슬롯 147 (p75 4, 꼬리 19) — 어려운 낱말을 줄인다" 까지
// 말하고 멈춘다. 옳은 태도다 — **낱말을 바꾸는 것은 집필하는 쪽의 일**이고, 기계가
// 고치면 글이 망가진다. 그런데 집필하는 쪽은 **어느 낱말이 꼬리인지 알 수가 없다.**
// `lexicon.json` 은 표본 120/80 낱말일 뿐이고 실제 등급은 사전 전체가 정하므로,
// 평범해 보이는 낱말이 조용히 꼬리에 들어간다(실측: `flat`·`piece`·`worth` 가 V4,
// `coin`·`iron`·`soil` 이 V5, `evenly`·`width`·`noon` 이 V7).
//
// 그래서 배치는 짐작으로 낱말을 덜어냈고, 덜 덜어내면 그대로 떨어지고 많이 덜어내면
// 한 계단 아래로 떨어졌다. **이 스크립트는 판정하지 않는다** — 검사기가 이미 센 그 꼬리를
// 등급과 함께 나열할 뿐이다. 무엇을 살리고 무엇을 바꿀지는 여전히 집필하는 쪽이 정한다.
//
// 실측 효과: V2 chunk-00 이 4/8 → **8/8**, chunk-02 가 5/8 → **8/8** 로 한 번에 붙었다.
//
// ⚠️ **채점 경로를 그대로 쓴다** — `extractBookLemmas` → `shared_dictionary.v_level`,
//   **v_level = 11 제외**. `write-drain-verify.mjs` 와 한 글자라도 다르면 여기서 본 낱말과
//   저기서 센 수가 어긋나고, 그러면 이 도구는 도움이 아니라 함정이 된다.
//
// ── 두 조건 (2026-08-30 실측으로 확정) ──────────────────────────────
// p75 가 목표 밴드에 앉으려면 **둘 다** 맞아야 한다. 하나만 보면 반대쪽으로 떨어진다:
//   ① 꼬리(밴드 초과 낱말) ≤ floor(등급낱말 / 4)
//   ② 적중(밴드 낱말)     ≥ (허용 − 꼬리) + 1
// **꼬리를 쉬운 낱말이 아니라 밴드 낱말로 바꾸면 둘이 함께 해결된다** — 꼬리가 하나 줄고
// 적중이 하나 는다. 쉬운 낱말로 바꾸면 ①만 고쳐지고 ②가 깨져 아래 계단으로 떨어진다.
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-tailwords.mjs --band 2
//   pnpm dlx tsx scripts/textbook/write-drain-tailwords.mjs --band 2 --only chunk-02
//   pnpm dlx tsx scripts/textbook/write-drain-tailwords.mjs --band 2 --slots 146,147,148

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
const SLOTS = arg('slots') ? new Set(arg('slots').split(',').map(Number)) : null
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

const { createClient } = await import('@supabase/supabase-js')
const { extractBookLemmas } = await import('@vocaflow/library-pipeline')

/** 채점기와 같이 v11 을 뺀다. 넣으면 실제보다 높게, 빼먹으면 낮게 나온다. */
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
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    if (SLOTS && !SLOTS.has(r.slot)) continue
    if (!String(r.content ?? '').trim()) continue
    rows.push(r)
  }
}
if (!rows.length) {
  console.log('고를 지문이 없다 (--slots 가 너무 좁거나 아직 안 채워졌다).')
  process.exit(0)
}

const perDoc = rows.map((r) => {
  const content = String(r.content)
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
  if (d.v_level != null && Number(d.v_level) !== V_LEVEL_EXCLUDED) level.set(d.word, Number(d.v_level))
}

console.log(`V${BAND} 꼬리 낱말 — 지문 ${rows.length}편\n`)
for (const d of perDoc) {
  const graded = d.lemmas.map((w) => [w, level.get(w)]).filter(([, v]) => v != null)
  const tail = graded.filter(([, v]) => v > BAND).sort((a, b) => b[1] - a[1])
  const at = graded.filter(([, v]) => v === BAND).length
  // **몇 개를 줄여야 하는지 직접 말한다.** p75 는 정렬한 등급낱말의 75% 지점이므로,
  // 그 자리가 목표 밴드 이하이려면 꼬리가 `floor(등급낱말/4)` 을 넘으면 안 된다.
  // 이 산술을 사람이 매번 하게 두면 한 편에 두세 번씩 왕복하게 된다(실측: V3 chunk-00 이
  // 2/9 → 4/9 → 4/9 로 두 번 헛돌았다 — 덜어내면 아래로 떨어지고 채우면 위로 떠올랐다).
  // p75 가 목표 밴드에 **정확히** 앉으려면 조건이 둘이다. 하나만 맞추면 반대쪽으로 떨어진다.
  //   ① 꼬리(밴드 초과) ≤ floor(등급낱말/4)    — 넘으면 위 계단으로
  //   ② 적중(밴드) ≥ (허용 − 꼬리) + 1          — 모자라면 아래 계단으로
  // ②를 안 적어 두면 "꼬리는 딱 맞는데 왜 떨어지지" 를 반복하게 된다(실측: V3 chunk-00·01·02 가
  // 2/9 → 4/9 → 8/9 → 9/9 로 세 번 왕복했고, 왕복의 절반이 ② 때문이었다 — 슬롯 248 은
  // 꼬리가 정확히 허용치인데 적중이 0 이라 V2 로 떨어졌다).
  const allowed = Math.floor(graded.length / 4)
  const over = tail.length - allowed
  const needAt = Math.max(1, allowed - tail.length + 1)
  const notes = []
  if (over > 0) notes.push(`꼬리 ${over}개를 쉬운 낱말로 바꾼다(위쪽부터)`)
  if (at < needAt) notes.push(`V${BAND} 낱말을 ${needAt - at}개 더 넣는다(쉬운 낱말을 밴드 낱말로 바꾸면 둘 다 해결된다)`)
  console.log(
    `### ${d.row.slot} ${d.row.title}\n` +
      `    등급낱말 ${graded.length} · 적중(V${BAND}) ${at}/${needAt} · 꼬리 ${tail.length}/${allowed}` +
      (notes.length ? `  → **${notes.join(' · ')}**` : '  → 두 조건 다 맞다'),
  )
  // 어려운 것부터 적는다 — 가장 위의 것을 바꿀 때 p75 가 가장 많이 내려간다.
  console.log('    ' + (tail.length ? tail.map(([w, v]) => `${w}:V${v}`).join(' ') : '(없음)') + '\n')
}

console.log(
  '**바꾸는 것은 집필하는 쪽의 일이다.** 여기 있는 것은 후보이지 지시가 아니다 —\n' +
    '소재의 핵심 낱말(예: 흙 글의 soil)은 꼬리여도 살려야 글이 남는다.\n' +
    `고친 뒤 write-drain-verify.mjs --band ${BAND} 로 다시 잰다.`,
)
