// scripts/csat/test-choice-cues.mjs
//
// **선지 표면 단서와 정답 배열 제약 — 지문을 안 읽고도 풀리는 구멍이 있는가.**
//
// 왜 이 둘인가. E8(번호→능력군)·E9(번호→3점)이 같은 것을 가리킨다 — **번호가 정한다**.
// 그렇다면 **선지와 정답 배열**에도 고정된 것이 있는지 봐야 한다.
// 그리고 이 둘은 검사 문헌이 **표준 결함 목록**으로 다루는 자리다:
//   · 길이 단서(length cue) — 정답이 가장 긴 선지인 경향. Millman·Bishop·Ebel(1965) 이후
//     문항작성 지침이 한결같이 금지하는 것. 실제 시험에서는 자주 남는다.
//   · 정답 배열 — 같은 번호가 잇따르는 것을 사람이 무의식적으로 피한다.
//
// **여기서 null 은 판정 보류가 아니라 기각이다.** 도구(글자 수 세기 · 순열)가 주장을
// 그대로 측정하고, 기저도 가정이 아니라 계산으로 나온다. 못 재는 것을 못 잰 것이 아니다.
//
// 기저:
//   길이 단서 — 5지선다에서 정답의 평균 길이 순위 3.0 (문항마다 정답 자리를 다시 뽑아 귀무분포)
//   정답 배열 — **같은 회차의 정답 다중집합을 그대로 섞어** 만든다(순열 검정 20,000회).
//               회차별 번호 편중(E5)을 자동으로 흡수하므로 가정이 안 들어간다.
//
// 실행: pnpm dlx tsx scripts/csat/test-choice-cues.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const ITER = 20000

const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

/** 동점은 평균 순위로 — 동점을 1등으로 세면 길이 단서가 부풀려진다 */
function avgRank(lens, idx) {
  const v = lens[idx]
  let less = 0
  let eq = 0
  for (const x of lens) { if (x < v) less += 1; else if (x === v) eq += 1 }
  return less + (eq + 1) / 2
}

const rows = allRows()

// A. 길이 단서
// 어법·어휘는 선지가 지문 속 밑줄이라 길이를 지문이 정한다 — 출제자의 선택이 아니다. 제외한다.
const EXCLUDE = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-VOCAB2'])
const lenRows = []
for (const r of rows) {
  if (EXCLUDE.has(r.type)) continue
  const a = answerOf(r.exam, r.no)
  if (!a) continue
  const block = itemBlocks(r.exam, r.no)[0]
  const ch = block && choicesOf(block)
  if (!ch || ch.length !== 5) continue
  if (ch.some((c) => !c || c.length < 2)) continue
  const lens = ch.map((c) => c.length)
  if (new Set(lens).size === 1) continue
  const k = a.answer - 1
  if (k < 0 || k > 4) continue
  lenRows.push({
    exam: r.exam,
    no: r.no,
    type: r.type,
    points: a.points,
    rank: avgRank(lens, k),
    longest: lens[k] === Math.max(...lens) && lens.filter((x) => x === lens[k]).length === 1,
    shortest: lens[k] === Math.min(...lens) && lens.filter((x) => x === lens[k]).length === 1,
    lens,
  })
}

const meanRank = lenRows.reduce((s, x) => s + x.rank, 0) / lenRows.length
const nLong = lenRows.filter((x) => x.longest).length
const nShort = lenRows.filter((x) => x.shortest).length

const rndA = mkRnd(20260825)
let ge = 0
let le = 0
for (let t = 0; t < ITER; t += 1) {
  let s = 0
  for (const x of lenRows) s += avgRank(x.lens, Math.floor(rndA() * 5))
  const m = s / lenRows.length
  if (m >= meanRank) ge += 1
  if (m <= meanRank) le += 1
}
const pRankTwo = Math.min(1, 2 * Math.min((ge + 1) / (ITER + 1), (le + 1) / (ITER + 1)))

console.log('선지 표면 단서와 정답 배열 제약')
console.log('='.repeat(74))
console.log('')
console.log('  A. 길이 단서 — 정답이 긴 선지인가')
console.log('  ' + '-'.repeat(70))
console.log(`    문항 ${lenRows.length} (어법·어휘 제외 — 선지가 지문이 정한 밑줄이라 출제자 선택이 아니다)`)
console.log(`    정답의 평균 길이 순위  ${meanRank.toFixed(3)}   (단서 없음 = 3.000)`)
console.log(`    순열 20,000회 양측 p = ${pRankTwo.toExponential(2)}`)
console.log(`    단독 최장이 정답  ${nLong}/${lenRows.length} = ${(100 * nLong / lenRows.length).toFixed(1)}%`)
console.log(`    단독 최단이 정답  ${nShort}/${lenRows.length} = ${(100 * nShort / lenRows.length).toFixed(1)}%`)

const byType = {}
for (const x of lenRows) (byType[x.type] ??= []).push(x)
console.log('')
console.log('    유형별 (G1 하위그룹 관문 — 전체 평균이 상쇄로 만들어진 것이 아닌지)')
const typeOut = {}
for (const [t, xs] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  if (xs.length < 20) continue
  const m = xs.reduce((s, y) => s + y.rank, 0) / xs.length
  typeOut[t] = { n: xs.length, mean: m }
  const bar = m > 3.15 ? '길다' : m < 2.85 ? '짧다' : '중앙'
  console.log(`      ${t.padEnd(12)} n=${String(xs.length).padStart(3)}  평균순위 ${m.toFixed(2)}  ${bar}`)
}

const p3 = lenRows.filter((x) => x.points === 3)
const p2 = lenRows.filter((x) => x.points === 2)
const m3 = p3.reduce((s, x) => s + x.rank, 0) / p3.length
const m2 = p2.reduce((s, x) => s + x.rank, 0) / p2.length
const rndB = mkRnd(777)
const pool = lenRows.map((x) => x.rank)
const diff = Math.abs(m3 - m2)
let cnt = 0
for (let t = 0; t < ITER; t += 1) {
  const sh = pool.slice()
  for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rndB() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
  const a = sh.slice(0, p3.length).reduce((s, v) => s + v, 0) / p3.length
  const b = sh.slice(p3.length).reduce((s, v) => s + v, 0) / (sh.length - p3.length)
  if (Math.abs(a - b) >= diff) cnt += 1
}
const pPts = (cnt + 1) / (ITER + 1)
console.log('')
console.log(`    3점 ${p3.length}문항 평균순위 ${m3.toFixed(3)} vs 2점 ${p2.length}문항 ${m2.toFixed(3)} — 순열 p = ${pPts.toFixed(4)}`)

// B. 정답 배열
console.log('')
console.log('  B. 정답 배열 — 같은 번호가 잇따르는 것을 피하는가')
console.log('  ' + '-'.repeat(70))

const exams = [...new Set(rows.map((r) => r.exam))].sort()
let obsAdj = 0
let obsN = 0
let obsMaxRun = 0
const seqs = []
for (const e of exams) {
  const nos = rows.filter((r) => r.exam === e).map((r) => r.no).sort((a, b) => a - b)
  const seq = nos.map((n) => answerOf(e, n)?.answer).filter((x) => x >= 1 && x <= 5)
  if (seq.length < 40) continue
  seqs.push({ exam: e, seq })
  let run = 1
  let mx = 1
  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] === seq[i - 1]) { obsAdj += 1; run += 1; if (run > mx) mx = run } else run = 1
    obsN += 1
  }
  obsMaxRun = Math.max(obsMaxRun, mx)
}

const rndC = mkRnd(31337)
let adjLE = 0
let adjGE = 0
let nullSum = 0
for (let t = 0; t < ITER; t += 1) {
  let adj = 0
  for (const { seq } of seqs) {
    const sh = seq.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rndC() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    for (let i = 1; i < sh.length; i += 1) if (sh[i] === sh[i - 1]) adj += 1
  }
  nullSum += adj
  if (adj <= obsAdj) adjLE += 1
  if (adj >= obsAdj) adjGE += 1
}
const nullMean = nullSum / ITER
const pAdj = Math.min(1, 2 * Math.min((adjLE + 1) / (ITER + 1), (adjGE + 1) / (ITER + 1)))

console.log(`    회차 ${seqs.length} · 인접쌍 ${obsN}`)
console.log(`    실측 인접 동일  ${obsAdj}  (${(100 * obsAdj / obsN).toFixed(1)}%)`)
console.log(`    같은 다중집합을 섞은 귀무 평균  ${nullMean.toFixed(1)}  (${(100 * nullMean / obsN).toFixed(1)}%)`)
console.log(`    순열 20,000회 양측 p = ${pAdj.toFixed(4)}`)
console.log(`    실측 최장 연속  ${obsMaxRun}`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(70))
if (pRankTwo < 0.05) console.log(`    · 길이 단서 **있다** — 평균순위 ${meanRank.toFixed(2)} ≠ 3.00, p=${pRankTwo.toExponential(1)}`)
else console.log(`    · 길이 단서 **없다** — 평균순위 ${meanRank.toFixed(2)}, p=${pRankTwo.toFixed(3)}. 도구가 주장을 그대로 재고 기저가 계산값이므로 **기각**이다`)
if (pAdj < 0.05) console.log(`    · 정답 배열 **제약 있다** — 실측 ${obsAdj} vs 귀무 ${nullMean.toFixed(1)}, p=${pAdj.toFixed(4)}`)
else console.log(`    · 정답 배열 **제약 없다** — 인접 동일이 무작위 섞기와 구분되지 않는다 (p=${pAdj.toFixed(3)})`)

const out = {
  lengthCue: { n: lenRows.length, meanRank, pTwoSided: pRankTwo, longest: nLong, shortest: nShort, byType: typeOut, points: { m3, m2, n3: p3.length, n2: p2.length, p: pPts } },
  answerOrder: { exams: seqs.length, pairs: obsN, observedAdjacent: obsAdj, nullMean, p: pAdj, maxRun: obsMaxRun },
}
fs.writeFileSync(path.join(DIR, 'choice-cues.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(DIR, 'choice-cues.json')}`)
