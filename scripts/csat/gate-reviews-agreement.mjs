// scripts/csat/gate-reviews-agreement.mjs
//
// **같은 청크를 두 판정자가 따로 판정했을 때 얼마나 같게 갈랐나 — 읽기 전용.**
//
// 왜: 서론·고찰 보관 판정 800편에서 청크별 보관 비율이 75~99%로 갈렸는데, 기계 점수·V-Level 분포는
// 청크끼리 비슷했다(retention-criteria-study-20260924). **글이 아니라 판정자가 달랐다**는 뜻이다.
// 기준 문구를 고치기 전에 이 흔들림을 재야 한다 — 재지 않으면 문구를 바꾼 효과와 판정자 차이를 구별할 수 없다.
//
// 비교하는 것은 **보관(use·narrative) 대 폐기(reject)** 두 갈래다. genre·uses 는 참고로만 센다.
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
const keep = (r) => r.verdict !== 'reject'

const ids = [...a.keys()].filter((id) => b.has(id))
if (!ids.length) throw new Error('두 파일에 같은 id 가 없다 — 같은 청크를 판정한 것인가')
let both = 0, neither = 0, onlyA = 0, onlyB = 0, sameGenre = 0
const disagree = []
for (const id of ids) {
  const x = a.get(id), y = b.get(id)
  if (x.genre === y.genre) sameGenre++
  if (keep(x) && keep(y)) both++
  else if (!keep(x) && !keep(y)) neither++
  else {
    if (keep(x)) onlyA++
    else onlyB++
    disagree.push({ id, a: `${x.verdict}/${x.genre}`, b: `${y.verdict}/${y.genre}`, whyA: x.why, whyB: y.why })
  }
}
const n = ids.length
const po = (both + neither) / n
const pa = (both + onlyA) / n
const pb = (both + onlyB) / n
const pe = pa * pb + (1 - pa) * (1 - pb)
const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe)
const out = {
  readOnly: true,
  compared: n,
  onlyInOne: a.size + b.size - 2 * n,
  keepRate: { a: +(pa * 100).toFixed(1), b: +(pb * 100).toFixed(1) },
  agreement: +(po * 100).toFixed(1),
  kappa: +kappa.toFixed(3),
  sameGenre: +((sameGenre / n) * 100).toFixed(1),
  disagreements: disagree.length,
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...out, disagree }, null, 2))
else {
  console.log(JSON.stringify(out))
  for (const d of disagree) console.log(`  ${d.id}  A ${d.a} · B ${d.b}\n    A: ${d.whyA}\n    B: ${d.whyB}`)
}
