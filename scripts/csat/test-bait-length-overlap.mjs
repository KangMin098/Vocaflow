// scripts/csat/test-bait-length-overlap.mjs
//
// **§6.12 와 §6.14 는 같은 것의 두 그림자인가.**
//
// 두 발견이 같은 방향을 가리킨다:
//   §6.12 미끼 격차 — 오답이 **지문을 문다**(지문↔오답 어휘 유사도가 정답보다 높다)
//   §6.14 길이 격차 — 빈칸에서 **정답이 오답보다 짧다**(3.7자)
//
// 자연스러운 이야기는 하나다 — 오답이 지문 낱말을 물고 늘어지니 길어진다.
// **그렇다면 독립 증거 둘이 아니라 하나다.** 지금 문서는 둘처럼 읽히게 써 두었고,
// 그건 증거를 두 번 세는 것이다. 재서 확인한다.
//
// 두 측도를 **한 자리에서 같은 문항 집합에 대해** 계산한다(따로 만든 파일을 이어 붙이면
// 표본이 어긋난다). 그리고:
//   1. 문항별 상관 r — 높으면 한 몸, 낮으면 서로 다른 것을 재고 있다
//   2. 길이를 통제해도 미끼 격차가 3점/2점을 가르는가 — 잔차로 다시 건다
//
// 상관 검정은 순열(20,000회 · 고정 시드). 정규성 가정을 안 쓴다.
//
// 실행: pnpm dlx tsx scripts/csat/test-bait-length-overlap.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

// §6.12 와 **똑같은** 어휘 처리를 쓴다 — 다르게 하면 비교가 성립하지 않는다
const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

const items = []
for (const r of allRows()) {
  if (r.type !== 'R-BLANK') continue
  const a = answerOf(r.exam, r.no)
  if (!a) continue
  const block = itemBlocks(r.exam, r.no)[0]
  if (!block) continue
  const ch = choicesOf(block)
  const passage = passageOf(block)
  if (!ch || ch.length !== 5 || !passage) continue
  if (ch.some((c) => !c || c.length < 2)) continue
  const k = a.answer - 1
  if (k < 0 || k > 4) continue
  items.push({ exam: r.exam, no: r.no, points: a.points, passage, choices: ch, k })
}

// IDF 는 선지 전체를 문서로 보고 만든다 (§6.12 와 동일)
const df = new Map()
for (const it of items) for (const c of it.choices) for (const w of new Set(toks(c))) df.set(w, (df.get(w) ?? 0) + 1)
const N = items.reduce((s, it) => s + it.choices.length, 0)
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1

function sim(a, b) {
  const A = new Set(toks(a))
  const B = new Set(toks(b))
  if (!A.size || !B.size) return 0
  let u = 0
  let i = 0
  for (const w of new Set([...A, ...B])) { const v = idf(w); u += v; if (A.has(w) && B.has(w)) i += v }
  return u ? i / u : 0
}

for (const it of items) {
  const key = it.choices[it.k]
  const dis = it.choices.filter((_, i) => i !== it.k)
  it.accessibility = sim(it.passage, key)
  it.distractorPassage = dis.reduce((s, d) => s + sim(it.passage, d), 0) / dis.length
  it.baitGap = it.distractorPassage - it.accessibility
  it.lenGap = dis.reduce((s, d) => s + d.length, 0) / dis.length - key.length
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
function pearson(x, y) {
  const mx = mean(x)
  const my = mean(y)
  let n = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < x.length; i += 1) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2 }
  return dx && dy ? n / Math.sqrt(dx * dy) : 0
}
function permR(x, y, seed) {
  const obs = Math.abs(pearson(x, y))
  const rnd = mkRnd(seed)
  let ge = 0
  for (let t = 0; t < ITER; t += 1) {
    const sh = y.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    if (Math.abs(pearson(x, sh)) >= obs) ge += 1
  }
  return { r: pearson(x, y), p: (ge + 1) / (ITER + 1) }
}

const bait = items.map((x) => x.baitGap)
const len = items.map((x) => x.lenGap)

console.log('§6.12 미끼 격차와 §6.14 길이 격차 — 같은 것의 두 그림자인가')
console.log('='.repeat(76))
console.log(`  빈칸 ${items.length}문항 · 두 측도를 같은 자리에서 계산했다`)
console.log('')

const c = permR(bait, len, 424242)
console.log('  1. 문항별 상관')
console.log('  ' + '-'.repeat(72))
console.log(`    미끼 격차 평균 ${mean(bait).toFixed(4)}  ·  길이 격차 평균 ${mean(len).toFixed(1)}자`)
console.log(`    Pearson r = ${c.r.toFixed(3)}   순열 20,000회 p = ${c.p.toFixed(4)}`)
console.log(`    공유 분산 r² = ${(c.r ** 2 * 100).toFixed(1)}%`)
console.log('')
const verdict = Math.abs(c.r) >= 0.5 ? '한 몸이다 — 증거를 두 번 세면 안 된다'
  : Math.abs(c.r) >= 0.3 ? '겹치지만 같지는 않다 — 부분적으로 독립'
    : '**서로 다른 것을 재고 있다** — 독립 증거 둘로 세도 된다'
console.log(`    → ${verdict}`)

// 2. 길이를 통제한 뒤에도 미끼 격차가 3점/2점을 가르는가
console.log('')
console.log('  2. 길이를 통제해도 미끼 격차가 3점/2점을 가르는가')
console.log('  ' + '-'.repeat(72))
const b = pearson(len, bait) * (Math.sqrt(len.reduce((s, v) => s + (v - mean(len)) ** 2, 0)) ? 1 : 1)
// 최소제곱 기울기
const mx = mean(len)
const my = mean(bait)
let num = 0
let den = 0
for (let i = 0; i < len.length; i += 1) { num += (len[i] - mx) * (bait[i] - my); den += (len[i] - mx) ** 2 }
const slope = den ? num / den : 0
const resid = items.map((x, i) => bait[i] - (my + slope * (len[i] - mx)))

const i3 = items.map((x, i) => i).filter((i) => items[i].points === 3)
const i2 = items.map((x, i) => i).filter((i) => items[i].points === 2)
function permDiff(vals, seed) {
  const a = mean(i3.map((i) => vals[i]))
  const bb = mean(i2.map((i) => vals[i]))
  const obs = Math.abs(a - bb)
  const rnd = mkRnd(seed)
  const pool = vals.slice()
  let ge = 0
  for (let t = 0; t < ITER; t += 1) {
    const sh = pool.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    const x = mean(sh.slice(0, i3.length))
    const y = mean(sh.slice(i3.length))
    if (Math.abs(x - y) >= obs) ge += 1
  }
  return { a, b: bb, p: (ge + 1) / (ITER + 1) }
}
const rawD = permDiff(bait, 5150)
const resD = permDiff(resid, 5151)
const lenD = permDiff(len, 5152)
console.log(`    3점 ${i3.length}문항 · 2점 ${i2.length}문항 (빈칸만)`)
console.log(`    길이 격차       3점 ${lenD.a.toFixed(2)}자  vs 2점 ${lenD.b.toFixed(2)}자   순열 p = ${lenD.p.toFixed(4)}`)
console.log(`    미끼 격차 원값   3점 ${rawD.a.toFixed(4)}  vs 2점 ${rawD.b.toFixed(4)}   순열 p = ${rawD.p.toFixed(4)}`)
console.log(`    미끼 격차 잔차   3점 ${resD.a.toFixed(4)}  vs 2점 ${resD.b.toFixed(4)}   순열 p = ${resD.p.toFixed(4)}`)
console.log(`    (잔차 = 길이 격차로 예측되는 몫을 뺀 나머지. 회귀 기울기 ${slope.toExponential(2)}/자)`)

fs.writeFileSync(path.join(DIR, 'bait-length-overlap.json'), JSON.stringify({
  n: items.length, r: c.r, p: c.p, r2: c.r ** 2, slope,
  points: { raw: rawD, resid: resD, len: lenD },
  rows: items.map((x) => ({ exam: x.exam, no: x.no, points: x.points, baitGap: x.baitGap, lenGap: x.lenGap })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'bait-length-overlap.json')}`)
