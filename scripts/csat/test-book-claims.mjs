// scripts/csat/test-book-claims.mjs
//
// **책의 기계 검증 가능한 명제들을 13개년 기출로 확인한다 — 읽기 전용.**
//
// 출처: 장진우, 『수능 영어영역 기출분석의 절대적 코드』(2016). 상용서라 주장만 가져온다.
//
// 여기서 거는 것 (전부 원문에 수치·단정으로 적힌 것들):
//   C1  "실제 수능에 출제되는 지문은 대략 **5~8문장**"                    (PART 03 도입)
//   C2  "한 지문에는 **반드시 하나의 주제**만 있다"                        (PART 03 도입)
//   C3  "핵심어는 지문에서 **가장 많이 반복된 단어**일 확률이 높다"          (Pattern 04)
//   C4  "**주제문에는 반드시 핵심어가 포함**되어 있어야 한다"                (Pattern 04)
//
// C2 는 의미 판단이라 기계로 못 잰다 — 여기서는 C1·C3·C4 만 다룬다.
// C4 는 이 저장소가 앞서 손으로 짚어 둔 **주제문 8개**로 검사하고, **기저를 함께 낸다**
// (임의 문장이 최빈어를 담을 확률). 기저 없이는 "반드시 포함" 이 의미가 없다.
//
// 실행: pnpm dlx tsx scripts/csat/test-book-claims.mjs

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
  if (j < 0 || j - i > 200) j = Math.min(i + 120, lines.length)
  return lines.slice(i, j)
}
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
const sentences = (t) =>
  t.split(/(?<=[.!?]["'’”)]?)\s+(?=["'“‘(]?[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 12)

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also there here
one two more make made take taken use used way ways thing things people`.split(/\s+/))
const content = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 3 && !STOP.has(w))
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ses|xes|ches|shes)$/, '').replace(/s$/, '')

/** 지문 = 문항 번호 줄 다음부터 첫 선택지 전까지 */
function passageOf(exam, no) {
  const L = itemLines(exam, no)
  if (!L) return null
  const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
  if (ci <= 0) return null
  return sentences(clean(L.slice(1, ci).filter((l) => l.trim()).join(' ')))
}

const classified = R('classified.json')
// 읽기 본문 유형 — 지문이 한 단락인 것만 (세트·장문 제외)
const SINGLE = ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM', 'R-PURPOSE', 'R-MOOD',
  'R-BLANK', 'R-IRRELEVANT', 'R-SUMMARY', 'R-IMPLY']

// ── C1  지문은 5~8문장인가 ────────────────────────────────────────────
const lens = []
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && SINGLE.includes(r.type))) {
  const s = passageOf(q.exam, q.no)
  if (s && s.length >= 2) lens.push(s.length)
}
lens.sort((a, b) => a - b)
const inRange = lens.filter((n) => n >= 5 && n <= 8).length
const med = lens[Math.floor(lens.length / 2)]
const mean = (lens.reduce((a, b) => a + b, 0) / lens.length)

console.log('C1  "지문은 대략 5~8문장"')
console.log('─'.repeat(70))
console.log(`  지문 ${lens.length}편 · 중앙값 ${med} · 평균 ${mean.toFixed(1)} · 범위 ${lens[0]}~${lens[lens.length - 1]}`)
console.log(`  5~8문장 구간 ${inRange}/${lens.length} = ${(100 * inRange / lens.length).toFixed(1)}%`)
const hist = new Map()
for (const n of lens) hist.set(n, (hist.get(n) ?? 0) + 1)
const bars = [...hist].sort((a, b) => a[0] - b[0])
for (const [n, c] of bars) {
  const mark = n >= 5 && n <= 8 ? '■' : '□'
  console.log(`    ${String(n).padStart(2)}문장 ${String(c).padStart(3)} ${mark.repeat(Math.max(1, Math.round(c / 3)))}`)
}
console.log(`  → ${inRange / lens.length >= 0.7 ? '대체로 맞다' : '**빗나간다**'}`)

// ── C3·C4  최빈어가 주제문에 포함되는가 ─────────────────────────────
// 이 저장소가 손으로 짚어 둔 주제문 8개 (CSAT_TYPE_DESIGN.md §1.1~1.2)
const THESES = [
  { exam: '2026', no: 23, head: 'Unless you' },
  { exam: '2026', no: 24, head: 'However, such commercialization' },
  { exam: '2023', no: 23, head: 'An important advantage of disclosure' },
  { exam: '2023', no: 24, head: 'However, one part of your brain' },
  { exam: '2020', no: 23, head: 'The interaction between nature' },
  { exam: '2021', no: 24, head: 'People don' },
  { exam: '2024', no: 23, head: 'But the economic benefits' },
  { exam: '2025', no: 22, head: 'The ability to understand emotions' },
]

console.log('')
console.log('C3·C4  "핵심어 = 최빈어" · "주제문에는 반드시 핵심어가 포함된다"')
console.log('─'.repeat(70))
let hit = 0, checked = 0
let baseHit = 0, baseTotal = 0
const rows = []
for (const t of THESES) {
  const s = passageOf(t.exam, t.no)
  if (!s) continue
  const freq = new Map()
  for (const x of s) for (const w of content(x).map(stem)) freq.set(w, (freq.get(w) ?? 0) + 1)
  const top = [...freq].sort((a, b) => b[1] - a[1])[0]
  if (!top) continue
  const thesis = s.find((x) => x.startsWith(t.head)) ?? s.find((x) => x.includes(t.head))
  if (!thesis) { rows.push({ id: `${t.exam}#${t.no}`, top: top[0], thesis: '못 찾음', ok: null }); continue }
  checked += 1
  const inThesis = content(thesis).map(stem).includes(top[0])
  if (inThesis) hit += 1
  // 기저 — 같은 지문의 임의 문장이 최빈어를 담는 비율
  for (const x of s) { baseTotal += 1; if (content(x).map(stem).includes(top[0])) baseHit += 1 }
  rows.push({ id: `${t.exam}#${t.no}`, top: top[0], n: top[1], ok: inThesis })
}
const base = baseHit / baseTotal
console.log('  문항       최빈어          주제문에 포함')
for (const r of rows) console.log(`  ${r.id.padEnd(10)} ${String(r.top).padEnd(15)} ${r.ok === null ? '판정 불가' : r.ok ? '✓' : '✗'}`)
console.log('')
console.log(`  주제문 포함 ${hit}/${checked} = ${(100 * hit / checked).toFixed(1)}%`)
console.log(`  **기저** (같은 지문의 임의 문장이 최빈어를 담는 비율) ${baseHit}/${baseTotal} = ${(100 * base).toFixed(1)}%`)
console.log(`  lift = ${(100 * (hit / checked - base)).toFixed(1)}%p`)
console.log('')
console.log(`  → ${hit === checked ? '"반드시 포함" 이 성립한다' : `**"반드시" 는 과장이다 — ${checked - hit}건 예외**`}`)

fs.writeFileSync(path.join(OUT_DIR, 'book-claims.json'), JSON.stringify(
  { C1: { n: lens.length, median: med, mean, inRange, rate: inRange / lens.length },
    C4: { checked, hit, base, lift: hit / checked - base, rows } }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'book-claims.json')}`)
