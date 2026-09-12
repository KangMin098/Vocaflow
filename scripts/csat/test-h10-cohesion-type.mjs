// scripts/csat/test-h10-cohesion-type.mjs
//
// **H10 — 평가원이 고르는 것은 '촘촘한 지문' 이 아니라 '가공할 수 있는 결속을 가진 지문' 인가.**
//
// ── 사전 예측 (돌리기 전에 적는다) ──────────────────────────────────
// 지난 사이클에서 결속 **총량** 은 선정 여부를 가르지 못했다(선정 0.915 vs 미선정 0.936).
// 그런데 성분을 뜯으니 구성이 반대로 보였다. 그건 **사후** 관찰이므로 여기서 사전 예측으로 다시 건다.
//
//   H10-a  선정된 지문은 미선정 산문보다 **지시적 결속 비율이 높다** (대명사·지시사로 문장을 잇는다)
//   H10-b  선정된 지문은 미선정 산문보다 **어휘 반복 비율이 낮다**   (같은 낱말을 되풀이해 잇지 않는다)
//
// 왜 그래야 하는가(설계 논리):
//   지시적 결속은 삽입·순서 문항을 **만들 수 있게 한다** — 문장을 옮기면 지시어가 깨지므로
//   자리가 특정된다. 어휘 반복만으로 이어진 글은 아무리 응집적이어도 자리가 안 잡힌다.
//   그렇다면 출제위원이 후보 문서 더미에서 고르는 기준은 결속의 **양** 이 아니라 **종류** 다.
//
// ── 대조군 ──────────────────────────────────────────────────────────
// 1차(control-prose.json) NOAA·OWID 기후·데이터 해설 — 전문 용어 반복이 많아 장르 교란이 컸다.
// 2차(control-prose2.json) The Conversation 학술 설명문 — **레지스터를 맞춘** 재검정용.
// 둘 다 낸다. 1차에서만 나오고 2차에서 사라지면 그건 장르 효과였다는 뜻이다.
//
// ⚠️ 예측이 틀리면 그대로 적는다. 12번째 실패라면 12번째라고 쓴다.
//
// 실행: pnpm dlx tsx scripts/csat/test-h10-cohesion-type.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const cache = new Map()
const examLines = (e) => {
  if (!cache.has(e)) {
    const p = path.join(COL_DIR, `${e}.txt`)
    cache.set(e, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(e)
}
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j)
}
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
const sentences = (t) =>
  t.split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 12)

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also there here`.split(/\s+/))
const content = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))
const DEICTIC = /\b(this|these|those|such|they|them|their|it|its|he|him|his|she|her|one|another|others)\b/i

/** 문단의 인접 문장쌍마다 두 결속을 따로 센다 */
function measure(sents) {
  let lex = 0, deic = 0, n = 0
  for (let i = 1; i < sents.length; i += 1) {
    const pw = new Set(content(sents[i - 1]))
    if (pw.size === 0) continue
    n += 1
    if (content(sents[i]).filter((w) => pw.has(w)).length > 0) lex += 1
    if (DEICTIC.test(sents[i].split(/\s+/).slice(0, 8).join(' '))) deic += 1
  }
  return { lex, deic, n }
}

function passageOf(q) {
  const L = itemLines(q.exam, q.no)
  if (!L) return null
  if (q.type === 'R-INSERT') {
    const blocks = []; let cur = []
    for (const raw of L.slice(1)) { if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw) }
    if (cur.length) blocks.push(cur)
    const en = blocks.filter((b) => /[A-Za-z]{3,}/.test(b.join(' ')))
    if (en.length < 2) return null
    const raw = en.slice(1).join(' ').replace(/\s+/g, ' ')
    if (!/\(\s*①\s*\)/.test(raw)) return null
    return sentences(clean(raw.replace(/\(\s*[①②③④⑤]\s*\)/g, ' ')))
  }
  const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
  const body = (ci > 0 ? L.slice(1, ci) : L.slice(1)).filter((l) => l.trim())
  return sentences(clean(body.join(' ')))
}

const classified = R('classified.json')
const SELECTED = ['R-INSERT', 'R-ORDER', 'R-TOPIC', 'R-TITLE', 'R-GIST', 'R-BLANK']

const acc = { lex: 0, deic: 0, n: 0, passages: 0 }
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && SELECTED.includes(r.type))) {
  const s = passageOf(q)
  if (!s || s.length < 4) continue
  const m = measure(s)
  acc.lex += m.lex; acc.deic += m.deic; acc.n += m.n; acc.passages += 1
}

const ctrls = []
for (const [label, file] of [['1차 대조군 (기후·데이터 해설)', 'control-prose.json'], ['2차 대조군 (학술 설명문)', 'control-prose2.json']]) {
  if (!fs.existsSync(path.join(OUT_DIR, file))) continue
  const c = R(file)
  const a = { lex: 0, deic: 0, n: 0, passages: 0 }
  for (const it of c.items) {
    const s = sentences(it.text)
    if (s.length < 4) continue
    const m = measure(s)
    a.lex += m.lex; a.deic += m.deic; a.n += m.n; a.passages += 1
  }
  ctrls.push({ label, ...a })
}

// Fisher 정확검정 (양측)
const lgam = (z) => {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z, t = x + 5.5
  t -= (x + 0.5) * Math.log(t)
  let s = 1.000000000190015
  for (let j = 0; j < 6; j += 1) s += g[j] / ++y
  return -t + Math.log(2.5066282746310005 * s / x)
}
const lch = (n, k) => (k < 0 || k > n ? -Infinity : lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1))
function fisher(a, b, c, d) {
  const n = a + b + c + d, r1 = a + b, c1 = a + c
  const lp = (x) => lch(r1, x) + lch(n - r1, c1 - x) - lch(n, c1)
  const o = lp(a)
  let p = 0
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x += 1) { const v = lp(x); if (v <= o + 1e-9) p += Math.exp(v) }
  return Math.min(1, p)
}

const pct = (a, b) => (100 * a / b).toFixed(1) + '%'
console.log('H10  선정 기준은 결속의 양이 아니라 종류인가')
console.log('─'.repeat(78))
console.log('  사전 예측  a) 선정 지문의 지시적 결속이 **높다**   b) 어휘 반복이 **낮다**')
console.log('')
console.log('  집단                          문단   문장쌍   지시결속   어휘반복')
console.log(`  ${'평가원 선정 지문'.padEnd(26)} ${String(acc.passages).padStart(4)}  ${String(acc.n).padStart(5)}   ${pct(acc.deic, acc.n).padStart(7)}   ${pct(acc.lex, acc.n).padStart(7)}`)
for (const c of ctrls) {
  console.log(`  ${c.label.padEnd(26)} ${String(c.passages).padStart(4)}  ${String(c.n).padStart(5)}   ${pct(c.deic, c.n).padStart(7)}   ${pct(c.lex, c.n).padStart(7)}`)
}

console.log('')
console.log('  판정')
console.log('─'.repeat(78))
const out = { selected: acc, controls: [] }
for (const c of ctrls) {
  const pA = fisher(acc.deic, acc.n - acc.deic, c.deic, c.n - c.deic)
  const pB = fisher(acc.lex, acc.n - acc.lex, c.lex, c.n - c.lex)
  const aOk = acc.deic / acc.n > c.deic / c.n
  const bOk = acc.lex / acc.n < c.lex / c.n
  console.log(`  vs ${c.label}`)
  console.log(`    a) 지시결속  ${pct(acc.deic, acc.n)} vs ${pct(c.deic, c.n)}  방향 ${aOk ? '적중' : '반대'} · p=${pA.toFixed(4)} ${pA < 0.05 ? '✓' : '✗'}`)
  console.log(`    b) 어휘반복  ${pct(acc.lex, acc.n)} vs ${pct(c.lex, c.n)}  방향 ${bOk ? '적중' : '반대'} · p=${pB.toFixed(4)} ${pB < 0.05 ? '✓' : '✗'}`)
  out.controls.push({ label: c.label, deic: c.deic, lex: c.lex, n: c.n, pA, pB, aOk, bOk })
}

const ctl2 = out.controls.find((c) => c.label.includes('2차'))
console.log('')
if (!ctl2) console.log('  2차 대조군이 없다 — 레지스터 통제 없이는 결론 못 낸다.')
else if (ctl2.aOk && ctl2.bOk && ctl2.pA < 0.05 && ctl2.pB < 0.05) console.log('  → **H10 채택** — 레지스터를 맞춰도 살아남았다. 선정 기준은 결속의 종류다.')
else if (ctl2.aOk && ctl2.bOk) console.log('  → 방향은 둘 다 맞는데 유의성 미달. 대조군을 늘려야 한다.')
else console.log('  → **H10 기각** — 레지스터를 맞추니 사라진다. 1차에서 본 것은 장르 효과였다.')

fs.writeFileSync(path.join(OUT_DIR, 'h10-cohesion-type.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'h10-cohesion-type.json')}`)
