// scripts/csat/gate-screen.mjs
//
// **게이트 규칙의 등가성 확인 — 읽기 전용. 아무것도 고치지 않는다.**
//
// ① 기출 810지문(대조군) 위에서 각 규칙의 **오탐률**. 실제 수능 지문을 떨어뜨리는
//    규칙은 틀린 규칙이므로 0.00% 가 아니면 그 규칙은 못 쓴다.
// ② 확보 코퍼스에서 각 규칙이 잡는 **적중 수**. 소스별로 나눠 보여 준다.
//
// 실행: node scripts/csat/gate-screen.mjs [--sample 20000]

import fs from 'node:fs'
import path from 'node:path'

import { HARD_RULES, hardReject } from './gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SAMPLE = Number(arg('sample', 20000))

console.log('게이트 규칙 등가성 확인 — 기출을 떨어뜨리면 그 규칙이 틀린 것이다')
console.log('='.repeat(78))

// ── ① 대조군: 기출 지문 ──────────────────────────────────────────────
const corpus = JSON.parse(fs.readFileSync(path.resolve('scripts/csat/data/corpus.json'), 'utf8'))
// ⚠️ **대조군 자체가 오염돼 있다.** `passage` 앞에 문항 번호(`39. `)가 붙어 오는 경우가
//   있고, 그것 때문에 `lex-list` 가 기출 10편을 떨어뜨린 것으로 나온다(2026-09-05).
//   규칙이 아니라 대조군을 고치는 자리다 — 지문 본문에는 없는 문자열이기 때문이다.
const control = corpus.items.filter((i) => i.passage && i.passage.length >= 200).map((i) => ({
  text: i.passage.replace(/^\s*\d{1,2}\.\s+/, ''),
  type: i.type_id ?? '(무)',
}))
console.log(`\n  대조군 기출 지문 **${control.length}편**\n`)

const fp = {}
for (const r of HARD_RULES) fp[r.id] = []
for (const c of control) for (const r of HARD_RULES) if (r.test(c.text)) fp[r.id].push(c)

console.log(`  ${'규칙'.padEnd(16)}${'기출 오탐'.padStart(10)}   사유`)
console.log('  ' + '-'.repeat(74))
let badRules = 0
for (const r of HARD_RULES) {
  const n = fp[r.id].length
  const pct = ((100 * n) / control.length).toFixed(2)
  if (n) badRules += 1
  console.log(`  ${r.id.padEnd(16)}${(n + ' (' + pct + '%)').padStart(10)}   ${r.why.slice(0, 44)}`)
}
console.log('  ' + '-'.repeat(74))
if (badRules) {
  console.log(`\n  ❌ **오탐이 있는 규칙 ${badRules}개** — 아래에 실제로 걸린 기출 지문을 보인다.`)
  console.log(`     규칙을 좁히거나 버릴 것. 이 상태로 적용하면 멀쩡한 지문이 사라진다.\n`)
  for (const r of HARD_RULES) {
    if (!fp[r.id].length) continue
    console.log(`  [${r.id}] ${fp[r.id].length}건`)
    for (const c of fp[r.id].slice(0, 3)) console.log(`     · ${c.type} — ${c.text.replace(/\s+/g, ' ').slice(0, 150)}`)
  }
} else {
  console.log(`\n  ✅ 기출 오탐 **0.00%** — 규칙 ${HARD_RULES.length}개 전부 통과.`)
}

// ── ② 확보 코퍼스에서의 적중 ────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log(`\n  확보 코퍼스 표본 ${SAMPLE.toLocaleString()}편을 훑는다 …`)
// ⚠️ `.range(from, ...)` + jsonb 필터는 매 쪽마다 전체를 다시 훑어 **statement timeout** 이
//   난다(2026-09-05 실측, 첫 쪽부터 실패). id 키셋으로 넘기면 PK 인덱스를 타서 안 죽는다.
const rows = []
const PAGE = 1000
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,source,title,content')
    .gt('csat_fit->>pass', '0')
    .gt('id', cursor)
    .order('id')
    .limit(PAGE)
  if (error) {
    console.error('\n  ❌ 조회 실패:', error.message)
    break
  }
  if (!data?.length) break
  rows.push(...data)
  cursor = data[data.length - 1].id
  process.stdout.write(`\r    ${rows.length.toLocaleString()}편`)
  if (data.length < PAGE || rows.length >= SAMPLE) break
}
console.log(`\n    표본 **${rows.length.toLocaleString()}편**\n`)

const bySource = {}
const hit = {}
for (const r of HARD_RULES) hit[r.id] = 0
let rejected = 0
for (const row of rows) {
  const s = row.source ?? '(무)'
  bySource[s] = bySource[s] ?? { n: 0, bad: 0 }
  bySource[s].n += 1
  const codes = hardReject(row.content)
  for (const c of codes) hit[c] += 1
  if (codes.length) {
    rejected += 1
    bySource[s].bad += 1
  }
}

console.log(`  ${'규칙'.padEnd(16)}${'적중'.padStart(9)}${'표본 대비'.padStart(11)}`)
console.log('  ' + '-'.repeat(74))
for (const r of HARD_RULES) {
  console.log(
    `  ${r.id.padEnd(16)}${hit[r.id].toLocaleString().padStart(9)}` +
      `${((100 * hit[r.id]) / Math.max(1, rows.length)).toFixed(1).padStart(10)}%`,
  )
}
console.log('  ' + '-'.repeat(74))
console.log(
  `  **게시 불가 ${rejected.toLocaleString()}편 / ${rows.length.toLocaleString()}편 ` +
    `(${((100 * rejected) / Math.max(1, rows.length)).toFixed(1)}%)**\n`,
)
console.log(`  ${'소스'.padEnd(14)}${'표본'.padStart(9)}${'불가'.padStart(9)}${'비율'.padStart(9)}`)
console.log('  ' + '-'.repeat(74))
for (const [s, v] of Object.entries(bySource).sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${s.padEnd(14)}${v.n.toLocaleString().padStart(9)}${v.bad.toLocaleString().padStart(9)}` +
      `${((100 * v.bad) / v.n).toFixed(1).padStart(8)}%`,
  )
}
console.log(
  `\n  ⚠️ 여기서 안 걸린 것이 “쓸 수 있다” 는 뜻은 아니다 — 장르(서사/논증)·교리·의사과학은\n` +
    `     기계로 못 가른다. 그 축은 책 단위 LLM 판정이 맡는다.`,
)
