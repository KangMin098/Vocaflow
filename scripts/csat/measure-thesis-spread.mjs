// scripts/csat/measure-thesis-spread.mjs
//
// **정답이 지문 어디에 흩어져 있는가 — 논지 통합 요구.** (§10.36)
//
// §6.12 는 "논지의 선명함" 을 **못 잰다**고 적고 남겨 두었다. 어휘 유사도는
// *같은 뜻 다른 낱말*을 못 잡으므로 그 축의 상한에 닿지 못한다. 그래서 **다른 것**을 잰다.
//
// `sim(정답 선지, 각 문장)` 을 구한 뒤:
//   · **집중도** `max / sum` — 정답이 **한 문장**에 몰린 정도. 1.0 이면 "그 문장 찾기" 문제
//   · **진입 문장 비율** — `sim > 0` 인 문장 비율
//   · **유효 문장 수** `exp(H)` — 정답이 실질적으로 몇 문장에 걸쳐 있는가 (H = 정규화 유사도의 엔트로피)
//
// ⚠️ **이것은 "선명함" 이 아니라 "통합 요구" 다.** 한 문장만 읽으면 풀리는가, 합쳐야 하는가.
//    낱말이 겹치는 자리만 세므로 **바꿔 쓴 재진술은 여전히 못 잡는다.** 그 한계는 그대로다.
//    이 파일이 §6.12 의 빈자리를 **메우지 않는다** — 그 옆에 다른 축을 하나 세울 뿐이다.
//
// 예측은 측정 전에 `data/thesis-spread-prereg.md` 에 박아 두었다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-thesis-spread.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'
import { pastItems, makeIdf, simWith, toks } from './check-choice-band.mjs'

const DIR = path.resolve('scripts/csat/data')
const SETS = ['v1', 'v2', 'v3', 'v4', 'v6']
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const SENT = (s) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => W(x).length >= 3)

const TYPES = new Set(['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-SUMMARY'])

// IDF 는 기출 선지 코퍼스에서 (check-choice-band 와 같은 자)
const idf = makeIdf(pastItems())
const sim = simWith(idf)

/** 정답이 문장들에 어떻게 퍼져 있는가 */
export function spread(passage, key) {
  const ss = SENT(passage)
  if (ss.length < 2) return null
  const v = ss.map((s) => sim(key, s))
  const sum = v.reduce((a, b) => a + b, 0)
  if (sum <= 0) return null
  const p = v.map((x) => x / sum)
  const H = -p.filter((x) => x > 0).reduce((a, x) => a + x * Math.log(x), 0)
  return {
    sents: ss.length,
    concentration: Math.max(...v) / sum,
    reachRate: v.filter((x) => x > 0).length / ss.length,
    effectiveSents: Math.exp(H),
  }
}

const past = []
for (const r of allRows()) {
  if (!TYPES.has(r.type)) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = cleanPassage(passageOf(b))
  if (!p || p.length < 150 || looksInterleaved(p)) continue
  const ch = choicesOf(b)
  const a = answerOf(r.exam, r.no)
  if (!ch || ch.length !== 5 || !a) continue
  const key = ch[a.answer - 1]
  if (!key || toks(key).length < 2) continue
  const s = spread(p, key)
  if (s) past.push({ src: '기출', exam: r.exam, no: r.no, type: r.type, points: a.points, ...s })
}

const gen = []
for (const v of SETS) {
  const fp = path.join(DIR, `generated-set-${v}.json`)
  if (!fs.existsSync(fp)) continue
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const it of j.items) {
    if (!TYPES.has(it.type)) continue
    const key = it.choices[it.answer - 1]
    const s = spread(it.passage, key)
    if (s) gen.push({ src: v, type: it.type, points: it.points, ...s })
  }
}

const mean = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length
const q = (a, k, x) => { const s = a.map((y) => y[k]).sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
function perm(A, B, k, seed) {
  const obs = Math.abs(mean(A, k) - mean(B, k))
  const pool = [...A, ...B].map((x) => x[k])
  const rnd = mkRnd(seed)
  let ge = 0
  for (let t = 0; t < ITER; t += 1) {
    const sh = pool.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    const m1 = sh.slice(0, A.length).reduce((s, x) => s + x, 0) / A.length
    const m2 = sh.slice(A.length).reduce((s, x) => s + x, 0) / B.length
    if (Math.abs(m1 - m2) >= obs) ge += 1
  }
  return { a: mean(A, k), b: mean(B, k), p: (ge + 1) / (ITER + 1) }
}
function holm(tests) {
  const ord = [...tests].sort((x, y) => x.r.p - y.r.p)
  let prev = 0
  ord.forEach((x, i) => { const adj = Math.max(prev, Math.min(1, (ord.length - i) * x.r.p)); prev = adj; x.holm = adj })
  return tests
}

const AX = [['concentration', '집중도(한 문장 몰림)'], ['effectiveSents', '유효 문장 수'], ['reachRate', '진입 문장 비율']]

console.log('논지 통합 요구 — 정답이 지문 어디에 흩어져 있는가')
console.log('='.repeat(80))
console.log(`  기출 ${past.length}문항 · 생성 ${gen.length}문항 (빈칸·주제·제목·요약)`)
console.log('  ⚠️ 이것은 "선명함" 이 아니라 **통합 요구** 다. 바꿔 쓴 재진술은 여전히 못 잡는다.')
console.log('')

console.log('  유형별 (기출)')
console.log('  ' + '-'.repeat(76))
console.log('  유형        n    집중도 10~50~90        유효문장수 10~50~90     진입비율(중앙)')
for (const t of ['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-SUMMARY']) {
  const xs = past.filter((x) => x.type === t)
  if (xs.length < 5) continue
  const f = (k, d) => `${q(xs, k, 0.1).toFixed(d)}~${q(xs, k, 0.5).toFixed(d)}~${q(xs, k, 0.9).toFixed(d)}`
  console.log(`  ${t.replace('R-', '').padEnd(11)}${String(xs.length).padStart(3)}  ${f('concentration', 3).padEnd(22)} ${f('effectiveSents', 2).padEnd(22)} ${q(xs, 'reachRate', 0.5).toFixed(2)}`)
}

// 예측 1 — 3점이 2점보다 통합 요구가 큰가
console.log('')
console.log('  **예측 1** — 3점이 2점보다 통합 요구가 크다 (순열 20,000회 · Holm 3검정)')
console.log('  ' + '-'.repeat(76))
const p3 = past.filter((x) => x.points === 3)
const p2 = past.filter((x) => x.points === 2)
const t1 = holm(AX.map(([k, n]) => ({ k, n, r: perm(p3, p2, k, 1000 + k.length) })))
for (const x of t1) {
  console.log(`    ${x.n.padEnd(22)} 3점 ${x.r.a.toFixed(4)}  2점 ${x.r.b.toFixed(4)}   raw ${x.r.p.toFixed(4)} → Holm ${x.holm.toFixed(4)}  ${x.holm < 0.05 ? '**다르다**' : '구분 안 됨'}`)
}
console.log(`    (3점 ${p3.length}문항 · 2점 ${p2.length}문항)`)

// 예측 3 — 생성이 기출보다 집중도가 높은가 (겨냥하지 않은 판만)
console.log('')
console.log('  **예측 3** — 생성(겨냥 안 한 v1~v4)이 기출보다 집중도가 높다')
console.log('  ' + '-'.repeat(76))
const gU = gen.filter((x) => ['v1', 'v2', 'v3', 'v4'].includes(x.src))
if (gU.length) {
  const t3 = holm(AX.map(([k, n]) => ({ k, n, r: perm(gU, past, k, 2000 + k.length) })))
  for (const x of t3) {
    console.log(`    ${x.n.padEnd(22)} 생성 ${x.r.a.toFixed(4)}  기출 ${x.r.b.toFixed(4)}   raw ${x.r.p.toFixed(4)} → Holm ${x.holm.toFixed(4)}  ${x.holm < 0.05 ? '**다르다**' : '구분 안 됨'}`)
  }
  console.log(`    (생성 ${gU.length}문항)`)
  console.log('')
  console.log('    판마다 — 집중도 (합산이 상쇄인지 본다 · P0.7)')
  for (const v of SETS) {
    const xs = gen.filter((x) => x.src === v)
    if (xs.length) console.log(`      ${v}  집중도 ${mean(xs, 'concentration').toFixed(4)}  유효문장 ${mean(xs, 'effectiveSents').toFixed(2)}  (n=${xs.length})`)
  }
}

fs.writeFileSync(path.join(DIR, 'thesis-spread.json'), JSON.stringify({ pastN: past.length, genN: gen.length, past, gen }, null, 1))
console.log(`\n→ ${path.join(DIR, 'thesis-spread.json')}`)

// ── **유형별 층화** — P0.7. 3점은 빈칸에 몰려 있고 빈칸은 집중도가 높다.
//    층화하지 않으면 "배점 효과" 가 **유형 혼합비**일 수 있다.
console.log('')
console.log('  **예측 1 층화** — 유형 안에서도 3점이 2점과 다른가 (유형별 Holm)')
console.log('  ' + '-'.repeat(76))
{
  const mix = ['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-SUMMARY'].map((t) => {
    const x3 = past.filter((x) => x.type === t && x.points === 3).length
    const x2 = past.filter((x) => x.type === t && x.points === 2).length
    return `${t.replace('R-', '')} 3점 ${x3}/2점 ${x2}`
  }).join(' · ')
  console.log(`    유형×배점 분포: ${mix}`)
  const tests = []
  for (const t of ['R-BLANK', 'R-TOPIC', 'R-TITLE']) {
    const A = past.filter((x) => x.type === t && x.points === 3)
    const B = past.filter((x) => x.type === t && x.points === 2)
    if (A.length < 4 || B.length < 4) { console.log(`    ${t.replace('R-', '').padEnd(10)} 표본 부족 (3점 ${A.length} · 2점 ${B.length}) — **판정 보류**`); continue }
    tests.push({ t, k: 'effectiveSents', r: perm(A, B, 'effectiveSents', 3000 + t.length), n3: A.length, n2: B.length })
  }
  holm(tests.map((x) => ({ ...x, r: x.r })))
  const ord = [...tests].sort((x, y) => x.r.p - y.r.p)
  let prev = 0
  ord.forEach((x, i) => { const adj = Math.max(prev, Math.min(1, (ord.length - i) * x.r.p)); prev = adj; x.holmV = adj })
  for (const x of tests) {
    console.log(`    ${x.t.replace('R-', '').padEnd(10)} 유효문장 3점 ${x.r.a.toFixed(2)} · 2점 ${x.r.b.toFixed(2)}  (n ${x.n3}/${x.n2})  raw ${x.r.p.toFixed(4)} → Holm ${x.holmV.toFixed(4)}  ${x.holmV < 0.05 ? '**다르다**' : '구분 안 됨'}`)
  }
}

// 예측 2 — 빈칸이 대의파악(주제·제목)보다 국소적인가
console.log('')
console.log('  **예측 2** — 빈칸은 국소 단서로 풀리고 대의파악은 통합을 요구한다')
console.log('  ' + '-'.repeat(76))
{
  const B = past.filter((x) => x.type === 'R-BLANK')
  const G = past.filter((x) => x.type === 'R-TOPIC' || x.type === 'R-TITLE')
  const tests = AX.map(([k, n]) => ({ k, n, r: perm(B, G, k, 5000 + k.length) }))
  holm(tests)
  for (const x of tests) {
    console.log(`    ${x.n.padEnd(22)} 빈칸 ${x.r.a.toFixed(4)}  대의파악 ${x.r.b.toFixed(4)}   raw ${x.r.p.toFixed(4)} → Holm ${x.holm.toFixed(4)}  ${x.holm < 0.05 ? '**다르다**' : '구분 안 됨'}`)
  }
  console.log(`    (빈칸 ${B.length}문항 · 주제+제목 ${G.length}문항)`)
}
