// scripts/csat/test-topic-position.mjs
//
// **외부 분석서 Pattern 06 검증 — "지문의 처음과 끝에 주의하라" 가 실제로 통하는가.**
//
// 출처: 장진우, 『수능 영어영역 기출분석의 절대적 코드』(2016) Pattern 06.
//       상용서라 주장만 가져와 검증한다. 본문은 옮기지 않는다.
//
// 주장을 검증 가능한 형태로: **대의파악 유형(주제·제목·요지)에서 정답의 근거가 되는 문장은
//                            지문의 처음 2문장 또는 마지막 2문장에 있다.**
//
// 측정 — 정답 선택지와 내용어를 가장 많이 공유하는 지문 문장을 '근거 문장' 으로 본다.
//        그 문장이 처음 2 / 마지막 2 안에 있는가.
//
// ⚠️ **base rate 를 함께 낸다.** 지문이 6문장이면 처음2+마지막2 는 이미 4/6 = 67% 다.
//    아무 문장이나 골라도 67% 가 맞는다는 뜻이다. 적중률만 보면 안 된다.
//    (이 저장소가 아홉 번 당한 오류이고, 검증 대상 책도 같은 자리에 있다 —
//     17개 패턴이 선정 안 된 산문 12편에도 100% 적용됐다. external-code-check.json)
// ⚠️ 어휘 중첩은 거친 대리다. 의미가 가까운데 낱말이 다른 근거 문장은 놓친다.
//
// 실행: pnpm dlx tsx scripts/csat/test-topic-position.mjs

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

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))
const MARK = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

// 대의파악 유형 중 **선택지가 영어인 것만** — 한글 선택지는 어휘 중첩으로 못 잰다
const TARGETS = ['R-TOPIC', 'R-TITLE']

const rows = []
let skipped = 0
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && TARGETS.includes(r.type))) {
  const L = itemLines(q.exam, q.no)
  if (!L) { skipped += 1; continue }
  const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
  if (ci <= 0) { skipped += 1; continue }
  const sents = sentences(clean(L.slice(1, ci).filter((l) => l.trim()).join(' ')))
  if (sents.length < 5) { skipped += 1; continue }

  const choices = new Map()
  for (const raw of L.slice(ci)) {
    const m = raw.trim().match(/^([①②③④⑤])\s*(.+)$/)
    if (m && !choices.has(MARK[m[1]])) choices.set(MARK[m[1]], clean(m[2]))
  }
  const ans = key.get(`${q.exam}#${q.no}`)?.answer
  if (!ans || !choices.has(ans)) { skipped += 1; continue }
  const cw = new Set(content(choices.get(ans)))
  if (cw.size < 2) { skipped += 1; continue }

  // 정답 선택지와 내용어를 가장 많이 공유하는 문장 = 근거 문장
  let best = -1, bv = -1
  sents.forEach((s, i) => {
    const v = content(s).filter((w) => cw.has(w)).length
    if (v > bv) { bv = v; best = i }
  })
  if (bv <= 0) { skipped += 1; continue }

  const n = sents.length
  const inEdge = best <= 1 || best >= n - 2
  const edgeSize = Math.min(4, n) // 처음2 + 마지막2 (짧으면 겹침)
  rows.push({ id: `${q.exam}#${q.no}`, n, idx: best, inEdge, baseRate: edgeSize / n })
}

const hit = rows.filter((r) => r.inEdge).length
const base = rows.reduce((s, r) => s + r.baseRate, 0) / rows.length
const rate = hit / rows.length

console.log('Pattern 06 검증 — "지문의 처음과 끝에 주의하라"')
console.log('─'.repeat(72))
console.log(`  대상 주제·제목 문항 ${rows.length}개 (제외 ${skipped}) · 지문 평균 ${(rows.reduce((s, r) => s + r.n, 0) / rows.length).toFixed(1)}문장`)
console.log('')
console.log(`  근거 문장이 처음2/마지막2 안   ${hit}/${rows.length} = ${(100 * rate).toFixed(1)}%`)
console.log(`  **base rate** (아무 문장이나 그 안일 확률)  ${(100 * base).toFixed(1)}%`)
console.log(`  lift = ${(100 * (rate - base)).toFixed(1)}%p`)
console.log('')

// Fisher
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
const expHit = Math.round(base * rows.length)
const p = fisher(hit, rows.length - hit, expHit, rows.length - expHit)
console.log(`  Fisher (관측 ${hit} vs 기저 기대 ${expHit})  p = ${p.toFixed(4)}  ${p < 0.05 ? '✓' : '✗'}`)
console.log('')
if (rate - base < 0.1) {
  console.log('  판정: **전략으로서 값이 없다.** 지문이 짧아 처음2+마지막2 가 이미 대부분을 덮는다.')
  console.log('        "처음과 끝을 보라" 는 조언은 사실상 "지문을 보라" 와 같다.')
} else if (p < 0.05) console.log('  판정: 실제로 처음·끝에 쏠린다. 전략에 값이 있다.')
else console.log('  판정: 방향은 있으나 유의성 미달.')

// 위치 분포 — 정규화해서 어디에 몰리는지
console.log('')
console.log('  근거 문장의 상대 위치 분포 (0=첫 문장, 1=마지막)')
const bins = new Array(5).fill(0)
for (const r of rows) bins[Math.min(4, Math.floor((r.idx / (r.n - 1)) * 5))] += 1
const labels = ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0']
bins.forEach((b, i) => console.log(`    ${labels[i]}  ${String(b).padStart(3)}  ${'█'.repeat(Math.round(40 * b / rows.length))}`))

fs.writeFileSync(path.join(OUT_DIR, 'topic-position.json'), JSON.stringify({ n: rows.length, hit, rate, base, lift: rate - base, p, bins, rows }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'topic-position.json')}`)
