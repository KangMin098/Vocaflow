// scripts/csat/gate-reviews-agreement.mjs
//
// **같은 청크를 두 판정자가 따로 판정했을 때 얼마나 같게 갈랐나 — 읽기 전용.**
//
// 왜: 서론·고찰 보관 판정 800편에서 청크별 보관 비율이 75~99%로 갈렸는데, 기계 점수·V-Level 분포는
// 청크끼리 비슷했다(retention-criteria-study-20260924). **글이 아니라 판정자가 달랐다**는 뜻이다.
// 기준 문구를 고치기 전에 이 흔들림을 재야 한다 — 재지 않으면 문구를 바꾼 효과와 판정자 차이를 구별할 수 없다.
//
// 비교하는 것: 보관 판정(`kind:"retain"`)이면 **keep · hold · discard 세 갈래**(docs/source-check/criteria.md §3-5),
// 옛 판정·내용 판정이면 보관(use·narrative) 대 폐기(reject) 두 갈래. 칸(slots)의 겹침도 참고로 센다.
// κ(Cohen) 는 우연 일치를 뺀 일치도다 — 보관이 90%인 집합에서는 아무렇게나 해도 일치율이 80%를 넘으므로
// 일치율만 보면 안 된다.
//
// 실행: node scripts/csat/gate-reviews-agreement.mjs <a.out.json> <b.out.json> [--json]

import fs from 'node:fs'

const [fa, fb] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
if (!fa || !fb) throw new Error('<a.out.json> <b.out.json> 두 판정 파일을 넘긴다')
const read = (f) => new Map(JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => [r.id, r]))
const a = read(fa)
const b = read(fb)
const label = (r) => r.retention ?? (r.verdict === 'reject' ? 'discard' : 'keep')

const ids = [...a.keys()].filter((id) => b.has(id))
if (!ids.length) throw new Error('두 파일에 같은 id 가 없다 — 같은 청크를 판정한 것인가')
const classes = ['keep', 'hold', 'discard']
const table = Object.fromEntries(classes.map((x) => [x, Object.fromEntries(classes.map((y) => [y, 0]))]))
let sameGenre = 0
let slotOverlap = 0
let slotPairs = 0
const disagree = []
for (const id of ids) {
  const x = a.get(id), y = b.get(id)
  const lx = label(x), ly = label(y)
  table[lx][ly]++
  if (x.genre === y.genre) sameGenre++
  if (x.slots && y.slots) {
    // 칸 겹침 — 유형·목적·연령 태그의 자카드 평균(어느 칸을 채우는지까지 같게 보는가).
    const jac = (p = [], q = []) => { const u = new Set([...p, ...q]); return u.size ? p.filter((v) => q.includes(v)).length / u.size : 1 }
    slotOverlap += (jac(x.slots.types, y.slots.types) + jac(x.slots.purposes, y.slots.purposes) + jac(x.slots.ages, y.slots.ages)) / 3
    slotPairs++
  }
  if (lx !== ly) disagree.push({ id, a: `${lx}/${x.genre}`, b: `${ly}/${y.genre}`, whyA: x.why, whyB: y.why })
}
const n = ids.length
const po = classes.reduce((s, c) => s + table[c][c], 0) / n
const rowP = (c) => classes.reduce((s, y) => s + table[c][y], 0) / n
const colP = (c) => classes.reduce((s, x) => s + table[x][c], 0) / n
const pe = classes.reduce((s, c) => s + rowP(c) * colP(c), 0)
const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe)
const out = {
  readOnly: true,
  compared: n,
  onlyInOne: a.size + b.size - 2 * n,
  rate: Object.fromEntries(classes.map((c) => [c, { a: +(rowP(c) * 100).toFixed(1), b: +(colP(c) * 100).toFixed(1) }])),
  agreement: +(po * 100).toFixed(1),
  kappa: +kappa.toFixed(3),
  sameGenre: +((sameGenre / n) * 100).toFixed(1),
  slotOverlap: slotPairs ? +((slotOverlap / slotPairs) * 100).toFixed(1) : null,
  disagreements: disagree.length,
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...out, table, disagree }, null, 2))
else {
  console.log(JSON.stringify(out))
  for (const d of disagree) console.log(`  ${d.id}  A ${d.a} · B ${d.b}\n    A: ${d.whyA}\n    B: ${d.whyB}`)
}
