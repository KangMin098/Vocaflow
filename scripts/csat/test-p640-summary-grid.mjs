// scripts/csat/test-p640-summary-grid.mjs
//
// **P6.40 — "요약(40번)은 A·B 두 추상어 쌍이고, 오답은 한쪽만 맞는 쌍이다" 를 전수로 건다.**
//
// 이 명제는 base rate 없이도 반증할 수 있는 드문 형태다.
// 선택지 다섯이 **독립으로 지어낸 다섯 쌍**이라면 (A) 다섯 낱말·(B) 다섯 낱말이 전부 다르다.
// "한쪽만 맞는 오답" 을 심으려면 반드시 **같은 (A) 또는 같은 (B) 가 되풀이돼야 한다.**
//
//   격자형 (명제가 맞다)   ① persisted…limit  ② persisted…cultivate  ③ evolved…accelerate
//                          ④ diminished…shape ⑤ diminished…restrict     → distinct(A)=3
//   독립형 (명제가 틀리다)  ① uncertainty…lose ② imbalance…split ③ challenges…secure
//                          ④ stability…reach  ⑤ advantages…support      → distinct(A)=5, distinct(B)=5
//
// 그래서 검정은 **distinct(A) < 5 또는 distinct(B) < 5** 인 회차의 비율이다.
// 기저는 가정이 아니라 구조에서 나온다 — 독립형이면 5,5 다.
//
// 더 강한 형태도 함께 잰다: **정답과 한 성분을 공유하는 오답이 존재하는가.**
// (격자여도 정답이 그 격자의 외딴 칸이면 "한쪽만 맞는 오답" 은 없다)
//
// 실행: pnpm dlx tsx scripts/csat/test-p640-summary-grid.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf } from './lib-passage.mjs'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows
const items = rows.filter((r) => r.type === 'R-SUMMARY')

/** "persisted … limit" → ['persisted','limit'] */
function splitPair(s) {
  const t = s.replace(/\s+/g, ' ').trim()
  const m = t.split(/\s*(?:…+|\.{2,}|⋯+|~+)\s*/).filter(Boolean)
  if (m.length < 2) return null
  const clean = (x) => x.replace(/[^A-Za-z\- ]/g, '').trim().toLowerCase()
  const a = clean(m[0]), b = clean(m.slice(1).join(' '))
  if (!a || !b) return null
  return [a, b]
}

const res = []
for (const it of items) {
  const b = itemBlocks(it.exam, it.no)[0]
  const ch = b ? choicesOf(b) : null
  if (!ch) { res.push({ exam: it.exam, no: it.no, ok: false, why: '선택지 추출 실패' }); continue }
  const pairs = ch.map(splitPair)
  if (pairs.some((p) => !p)) { res.push({ exam: it.exam, no: it.no, ok: false, why: '쌍 분리 실패', raw: ch }); continue }
  const A = pairs.map((p) => p[0]), B = pairs.map((p) => p[1])
  const dA = new Set(A).size, dB = new Set(B).size
  const ans = answerOf(it.exam, it.no)
  const k = ans ? ans.answer - 1 : -1
  let shareOne = null
  if (k >= 0 && k < 5) {
    shareOne = pairs.filter((p, i) => i !== k && ((p[0] === A[k]) !== (p[1] === B[k]))).length
  }
  res.push({
    exam: it.exam, no: it.no, ok: true,
    pairs, dA, dB, grid: dA < 5 || dB < 5, answer: k + 1, shareOne,
  })
}

const good = res.filter((r) => r.ok)
const grid = good.filter((r) => r.grid)
const withShare = good.filter((r) => r.shareOne != null && r.shareOne >= 1)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P6.40 — 요약 선택지가 "격자" 인가 "독립 다섯 쌍" 인가')
console.log('='.repeat(74))
console.log(`  대상 ${items.length}문항 · 파싱 성공 ${good.length}`)
console.log()
console.log('  회차    distinct(A)  distinct(B)  격자?  정답  한쪽공유 오답')
console.log('  ' + '-'.repeat(70))
for (const r of res) {
  if (!r.ok) { console.log(`  ${r.exam.padEnd(7)} ${r.why}`); continue }
  console.log(
    `  ${r.exam.padEnd(7)} ${String(r.dA).padStart(9)} ${String(r.dB).padStart(12)}  ` +
    `${(r.grid ? '격자' : '독립').padStart(4)}  ${String(r.answer).padStart(4)} ${String(r.shareOne ?? '-').padStart(10)}`,
  )
}
console.log()

// 기저 — 독립으로 다섯 쌍을 지으면 distinct 는 5,5 다. 즉 "격자" 확률은 0 에 가깝다.
// 후하게 잡아 0.2 로 두어도 아래 p 는 그대로 나온다.
for (const base of [0.05, 0.2]) {
  const p = binomUpper(good.length, grid.length, base)
  console.log(`  격자 ${grid.length}/${good.length} = ${pct(grid.length, good.length)}%   기저 ${base} 가정 시 이항 p = ${p.toExponential(2)}`)
}
console.log()
console.log(`  정답과 한 성분을 공유하는 오답이 1개 이상: ${withShare.length}/${good.filter((r) => r.shareOne != null).length}`)
console.log()

const nonGrid = good.filter((r) => !r.grid)
if (nonGrid.length) {
  console.log(`  ⚠️ 예외 ${nonGrid.length}건 — 다섯 쌍이 전부 다르다 (한쪽만 맞는 오답이 원리상 없다)`)
  for (const r of nonGrid) console.log(`     ${r.exam}#${r.no}  ` + r.pairs.map((p) => p.join('/')).join('  '))
  console.log()
}

// ── 관문 ──────────────────────────────────────────────────────────────
// 회차 순서로 늘어놓으면 눈에 띄는 것이 있다. G4 를 반드시 거쳐야 한다.
const { report } = await import('./claim-gate.mjs')
const order = ['2014B', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']
const byExam = Object.fromEntries(good.map((r) => [r.exam, r.grid ? 1 : 0]))
const perExam = order.filter((e) => e in byExam).map((e) => ({ exam: e, hit: byExam[e], n: 1 }))

console.log()
console.log('  회차 순서:  ' + perExam.map((x) => `${x.exam}${x.hit ? '격' : '독'}`).join(' '))
console.log()

const early = perExam.filter((x) => +x.exam.slice(0, 4) <= 2020)
const late = perExam.filter((x) => +x.exam.slice(0, 4) >= 2021)
const eh = early.filter((x) => x.hit).length, lh = late.filter((x) => x.hit).length

report({
  name: `P6.40 초안 형태 — "요약 오답은 한쪽만 맞는 쌍이다" (전 기간)  [검사]`,
  hit: grid.length, n: good.length, baseRate: 0.2, shape: 'count-vs-baserate',
  falsifier: '선택지 다섯 쌍의 (A)·(B) 가 모두 서로 다르면(5,5) 한쪽만 맞는 오답이 원리상 없다 — 그런 회차가 나오면 깨진다',
  subgroups: [{ label: '~2020', hit: eh, n: early.length }, { label: '2021~', hit: lh, n: late.length }],
  perExam,
})

report({
  name: `P6.40 시기 형태 — "2020학년도까지는 격자였다"  [검사]`,
  hit: eh, n: early.length, baseRate: 0.2, shape: 'count-vs-baserate',
  falsifier: '2020 이전 어느 회차든 다섯 쌍이 모두 다르면 깨진다',
  subgroups: [{ label: '2014B~2017', hit: early.slice(0, 4).filter((x) => x.hit).length, n: early.slice(0, 4).length },
    { label: '2018~2020', hit: early.slice(4).filter((x) => x.hit).length, n: early.slice(4).length }],
  perExam: early,
})

fs.writeFileSync(path.join(DIR, 'p640-summary-grid.json'), JSON.stringify({ n: good.length, grid: grid.length, withShare: withShare.length, early: { hit: eh, n: early.length }, late: { hit: lh, n: late.length }, rows: res }, null, 1))
console.log(`→ ${path.join(DIR, 'p640-summary-grid.json')}`)
