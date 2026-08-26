// scripts/csat/score-generated-bait.mjs
//
// **§10.16 이 남긴 빈자리 — 계측 대역은 맞췄는데 오답이 기출만큼 매력적인가.**
//
// v4 는 표면 계측에서 96.1% 였다. 그러나 그 96.1% 는 **내가 겨냥한 축**이라 순환이었다.
// **오답 매력도는 겨냥하지 않았다** — 규칙(§6.12)을 읽고 쓰긴 했지만 **수치를 계산하며 쓰지 않았다.**
// 그래서 이 축은 v1~v4 모두에서 **독립 판정**이 된다.
//
// §6.12 의 측도를 그대로 쓴다(IDF 가중 어휘 유사도):
//   · 접근성   accessibility      = sim(지문, 정답)
//   · 지문 미끼 distractorPassage = 평균 sim(지문, 오답)
//   · 미끼 격차 baitGap           = 지문 미끼 − 접근성
//   · 혼동도   confusion          = 평균 sim(정답, 오답)
//
// 기출 기준(§6.12): 빈칸 3점 지문 미끼 **0.0207** vs 2점 0.0142 (순열 p=0.0051).
//
// ⚠️ **IDF 는 기출 코퍼스에서 만든다.** 생성 문항의 낱말이 기출에 없으면 IDF 가 높게 잡혀
//    유사도가 과소평가된다. 그래서 **기출과 생성 선지를 한 코퍼스에 넣어** IDF 를 만든다 —
//    안 그러면 두 집단을 다른 자로 재게 된다.
//
// 실행: pnpm dlx tsx scripts/csat/score-generated-bait.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const SETS = ['generated-set-v1.json', 'generated-set-v2.json', 'generated-set-v3.json', 'generated-set-v4.json', 'generated-set-v5.json', 'generated-set-v6.json']
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

// ── 문항 모으기 ─────────────────────────────────────────────────────────────
const TYPES = new Set(['R-BLANK', 'R-TOPIC', 'R-TITLE'])
const past = []
for (const r of allRows()) {
  if (!TYPES.has(r.type)) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  const ch = choicesOf(b)
  const a = answerOf(r.exam, r.no)
  if (!p || p.length < 150 || !ch || ch.length !== 5 || !a) continue
  if (ch.some((c) => toks(c).length < 2)) continue
  past.push({ src: '기출', type: r.type, points: a.points, passage: p, choices: ch, k: a.answer - 1 })
}

const gen = []
for (const f of SETS) {
  const fp = path.join(DIR, f)
  if (!fs.existsSync(fp)) continue
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'))
  for (const it of j.items) {
    if (!TYPES.has(it.type)) continue
    if (it.choices.some((c) => toks(c).length < 2)) continue
    gen.push({ src: f.replace('generated-set-', '').replace('.json', ''), type: it.type, points: it.points, passage: it.passage, choices: it.choices, k: it.answer - 1 })
  }
}

// ── IDF 는 두 집단을 합쳐서 만든다 (다른 자로 재지 않으려고) ────────────────
const all = [...past, ...gen]
const df = new Map()
for (const it of all) for (const c of it.choices) for (const w of new Set(toks(c))) df.set(w, (df.get(w) ?? 0) + 1)
const N = all.reduce((s, it) => s + it.choices.length, 0)
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
for (const it of all) {
  const key = it.choices[it.k]
  const dis = it.choices.filter((_, i) => i !== it.k)
  it.accessibility = sim(it.passage, key)
  it.distractorPassage = dis.reduce((s, d) => s + sim(it.passage, d), 0) / dis.length
  it.baitGap = it.distractorPassage - it.accessibility
  it.confusion = dis.reduce((s, d) => s + sim(key, d), 0) / dis.length
}

const mean = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length
const qs = (a, k, q) => { const s = a.map((x) => x[k]).sort((m, n) => m - n); return s[Math.floor(q * (s.length - 1))] }

console.log('오답 매력도 — 생성 문항이 기출만큼 무는가')
console.log('='.repeat(78))
console.log(`  기출 ${past.length}문항 · 생성 ${gen.length}문항 (빈칸·주제·제목만) · IDF 는 두 집단을 합쳐 만들었다`)
console.log('')

const AX = [
  { k: 'distractorPassage', name: '지문 미끼 (지문↔오답)' },
  { k: 'accessibility', name: '접근성 (지문↔정답)' },
  { k: 'baitGap', name: '미끼 격차 (오답−정답)' },
  { k: 'confusion', name: '혼동도 (정답↔오답)' },
]
console.log('  측도                     기출(중앙)   기출 10~90%대역        생성 판별')
console.log('  ' + '-'.repeat(74))
const rows = []
for (const a of AX) {
  const lo = qs(past, a.k, 0.1)
  const hi = qs(past, a.k, 0.9)
  const md = qs(past, a.k, 0.5)
  const byV = {}
  for (const v of ['v1', 'v2', 'v3', 'v4']) {
    const xs = gen.filter((x) => x.src === v)
    if (!xs.length) continue
    byV[v] = { n: xs.length, mid: qs(xs, a.k, 0.5), inBand: xs.filter((x) => x[a.k] >= lo && x[a.k] <= hi).length }
  }
  rows.push({ axis: a.name, past: { lo, md, hi }, byV })
  const cells = Object.entries(byV).map(([v, x]) => `${v} ${x.mid.toFixed(4)}(${x.inBand}/${x.n})`).join('  ')
  console.log(`  ${a.name.padEnd(22)} ${md.toFixed(4)}   ${lo.toFixed(4)} ~ ${hi.toFixed(4)}`)
  console.log(`  ${''.padEnd(22)} ${cells}`)
}

// 순열 검정 — 생성 전체 vs 기출, 지문 미끼
console.log('')
console.log('  생성 전체 vs 기출 — 순열 20,000회')
console.log('  ' + '-'.repeat(74))
function permTwo(A, B, k, seed) {
  const obs = Math.abs(mean(A, k) - mean(B, k))
  const pool = [...A, ...B].map((x) => x[k])
  const rnd = mkRnd(seed)
  let ge = 0
  for (let t = 0; t < ITER; t += 1) {
    const sh = pool.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    const m1 = sh.slice(0, A.length).reduce((s, v) => s + v, 0) / A.length
    const m2 = sh.slice(A.length).reduce((s, v) => s + v, 0) / B.length
    if (Math.abs(m1 - m2) >= obs) ge += 1
  }
  return { a: mean(A, k), b: mean(B, k), p: (ge + 1) / (ITER + 1) }
}
const out = {}
for (const a of AX) out[a.k] = permTwo(gen, past, a.k, 4242 + a.k.length)
// ⚠️ **네 측도를 동시에 보므로 Holm 보정을 건다.** 이 저장소의 규율이다 —
// raw p 만 보면 넷 중 하나는 우연히 0.05 를 밑돈다.
const ordered = AX.map((a) => ({ ...a, r: out[a.k] })).sort((x, y) => x.r.p - y.r.p)
let prev = 0
ordered.forEach((x, i) => { const adj = Math.max(prev, Math.min(1, (ordered.length - i) * x.r.p)); prev = adj; x.r.holm = adj })
for (const a of AX) {
  const r = out[a.k]
  const mark = r.holm < 0.05 ? '**다르다**' : r.p < 0.05 ? '△ raw 만 (Holm 에서 무너짐)' : '구분 안 됨'
  console.log(`  ${a.name.padEnd(22)} 생성 ${r.a.toFixed(4)}  기출 ${r.b.toFixed(4)}   raw ${r.p.toFixed(4)} → Holm ${r.holm.toFixed(4)}  ${mark}`)
}

// ── **유형별 층화** — 이 스크립트가 한 번 틀린 자리다 ─────────────────────────
// 2026-08-26: 위 합산 검정만 보고 "생성 오답의 혼동도가 기출보다 낮다(Holm 0.024)" 를
// 격차로 보고했다. 유형별로 가르니 **빈칸의 기출 중앙이 0.0000** 이었고 내 것은 8/8 대역 안이었다.
// 즉 **멀쩡한 것을 결함으로 적었고**, 그 진단을 믿고 고친 v5 는 빈칸을 대역 상단의 두 배로 밀어 올렸다.
// 유형마다 대역 중앙이 다르면 **합산은 두 집단의 유형 혼합비 차이를 재는 것**이 된다.
console.log('')
console.log('  **유형별 층화** — 혼동도 (겨냥하지 않은 판 v1~v4 만)')
console.log('  ' + '-'.repeat(74))
const UNAIMED = new Set(['v1', 'v2', 'v3', 'v4'])
const strat = []
for (const t of ['R-BLANK', 'R-TOPIC', 'R-TITLE']) {
  const P = past.filter((x) => x.type === t)
  const G = gen.filter((x) => x.type === t && UNAIMED.has(x.src))
  if (P.length < 8 || !G.length) continue
  const lo = qs(P, 'confusion', 0.1)
  const md = qs(P, 'confusion', 0.5)
  const hi = qs(P, 'confusion', 0.9)
  const r = permTwo(G, P, 'confusion', 700 + t.length)
  strat.push({ t, r, lo, md, hi, inB: G.filter((x) => x.confusion >= lo && x.confusion <= hi).length, n: G.length })
}
{
  const ord = [...strat].sort((x, y) => x.r.p - y.r.p)
  let pv = 0
  ord.forEach((x, i) => { const adj = Math.max(pv, Math.min(1, (ord.length - i) * x.r.p)); pv = adj; x.holm = adj })
}
for (const s of strat) {
  console.log(`    ${s.t.replace('R-', '').padEnd(8)} 기출 ${s.lo.toFixed(4)}~**${s.md.toFixed(4)}**~${s.hi.toFixed(4)}  생성 ${s.r.a.toFixed(4)}  대역안 ${s.inB}/${s.n}  raw ${s.r.p.toFixed(4)} → Holm ${s.holm.toFixed(4)}  ${s.holm < 0.05 ? '**다르다**' : '구분 안 됨'}`)
}
console.log('')
console.log('  **유형별 층화** — 겨냥한 판 (v5 · v6) 은 대역 안에 들어갔는가')
console.log('  ' + '-'.repeat(74))
for (const v of ['v5', 'v6']) {
  const cells = []
  for (const t of ['R-BLANK', 'R-TOPIC', 'R-TITLE']) {
    const P = past.filter((x) => x.type === t)
    const G = gen.filter((x) => x.type === t && x.src === v)
    if (!G.length || P.length < 8) continue
    const lo = qs(P, 'confusion', 0.1)
    const hi = qs(P, 'confusion', 0.9)
    cells.push(`${t.replace('R-', '')} ${mean(G, 'confusion').toFixed(4)} (${G.filter((x) => x.confusion >= lo && x.confusion <= hi).length}/${G.length})`)
  }
  if (cells.length) console.log(`    ${v}  ${cells.join('   ')}`)
}

console.log('')
console.log('  판마다 따로 — 지문 미끼 · 혼동도 (Holm 은 위 4검정 기준)')
console.log('  ' + '-'.repeat(74))
for (const v of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
  const xs = gen.filter((x) => x.src === v)
  if (!xs.length) continue
  const c = permTwo(xs, past, 'confusion', 900 + v.length)
  const d = permTwo(xs, past, 'distractorPassage', 950 + v.length)
  console.log(`    ${v}  혼동도 ${c.a.toFixed(4)} (p=${c.p.toFixed(3)})   지문미끼 ${d.a.toFixed(4)} (p=${d.p.toFixed(3)})`)
}

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
// ⚠️ **합산 null 을 그대로 믿으면 안 된다(§6.14 의 G1 교훈).**
// 판별로 보면 v1~v4 는 혼동도가 기출보다 **낮고** v5 는 **높다** — 합치면 상쇄된다.
const conf = {}
for (const v of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
  const xs = gen.filter((x) => x.src === v)
  if (xs.length) conf[v] = mean(xs, 'confusion')
}
const pastConf = mean(past, 'confusion')
const below = Object.entries(conf).filter(([, m]) => m < pastConf).map(([v]) => v)
const above = Object.entries(conf).filter(([, m]) => m > pastConf).map(([v]) => v)
// ⚠️ **판정은 합산이 아니라 층화에서 읽는다.** 합산 Holm 이 전부 1.000 이어도
// 그것은 유형 혼합비가 상쇄된 결과일 수 있다 — 실제로 그랬다(§10.22).
// 그리고 **겨냥한 판(v5·v6)은 판정의 근거가 아니다.** 근거는 v1~v4 뿐이다.
const diffT = strat.filter((s) => s.holm < 0.05)
if (!diffT.length) {
  console.log('    · **겨냥하지 않은 판(v1~v4)의 혼동도는 유형별로도 기출과 구분되지 않는다.**')
} else {
  console.log(`    · 겨냥하지 않은 판에서 기출과 다른 유형: ${diffT.map((s) => s.t.replace('R-', '')).join(' · ')}`)
  console.log('      **이 축은 v1~v4 에서 겨냥하지 않았으므로 이 차이는 진짜다.**')
  console.log(`      나머지 유형(${strat.filter((s) => s.holm >= 0.05).map((s) => s.t.replace('R-', '')).join(' · ')})은 구분되지 않는다 — **전부가 깨진 것이 아니다.**`)
}
const diff = AX.filter((a) => out[a.k].holm < 0.05)
console.log(`    · 합산 4측도 중 기출과 다른 것: ${diff.length ? diff.map((a) => a.name).join(' · ') : '**없음** — 그러나 이것만으로 "같다" 고 적으면 안 된다(아래)'}`)
console.log('')
console.log(`    ⚠️ **합산 null 은 상쇄의 산물이다.** 기출 혼동도 ${pastConf.toFixed(4)} 을 기준으로`)
console.log(`       아래인 판 ${below.join(' ')} · 위인 판 ${above.join(' ')} — 합치면 지워진다.`)
console.log('       **판별로 봐야 한다**(§6.14 의 G1 교훈이 여기서도 걸린다).')
console.log('    ⚠️ 어휘 유사도는 **같은 뜻 다른 낱말**을 못 잡는다(§6.12 의 한계 그대로).')
console.log('       "오답이 매력적인가" 의 상한이 아니라 **표면 겹침**만 재는 것이다.')

fs.writeFileSync(path.join(DIR, 'generated-bait-score.json'), JSON.stringify({ pastN: past.length, genN: gen.length, rows, perm: out }, null, 1))
console.log(`\n→ ${path.join(DIR, 'generated-bait-score.json')}`)
