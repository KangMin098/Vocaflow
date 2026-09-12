// scripts/csat/measure-source-genre.mjs
//
// **난도만으로는 소스를 못 고른다 — 장르도 재야 한다.**
//
// §10 은 어휘 난도를 쟀고 외부 수집 소스의 52.9% 가 기출 중앙을 넘는다는 것을 보였다.
// 그런데 그 소스들을 실제로 열어 보니 **문항을 못 만든다**:
//   · NASA 뉴스 릴리스 — `2 Min Read` `Credit` 같은 머리글, 그리고 **논지가 없는 기술적 서술**
//   · OWID — `Cite this article` 보일러플레이트에 1인칭("My local supermarket here in Scotland")
//   · APOD — 내비게이션 메뉴가 본문에 섞여 있다
//
// **수능 지문은 논지가 있는 3인칭 설명문**이다. 빈칸·주제·제목은 논지가 없으면 아예 안 만들어진다.
// 그래서 난도와 별개로 **장르**를 재야 한다. 지표는 사전 없이 계산되는 것만 쓴다:
//
//   · 1인칭 비율   — I · my · we · our · me · us (수능 지문은 거의 0)
//   · 고유명사 밀도 — 문장 중간의 대문자 시작 낱말 (뉴스·기술문서는 높다)
//   · 숫자 밀도     — 연도 · 수치
//   · 보일러플레이트 — `Min Read` `Credit` `Cite this` `Explanation:` `Date` 등의 표지
//
// ⚠️ **이 지표들은 장르의 대리 지표다.** "논지가 있는가" 를 직접 재지는 못한다 —
//    그건 손판독이 필요하다. 여기서 재는 것은 **명백히 아닌 것을 걸러 내는 하한**이다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-source-genre.mjs <덤프1> <덤프2> ...

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const dumps = process.argv.filter((x) => x.endsWith('.txt'))

const words = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const FIRST = new Set(['i', 'my', 'we', 'our', 'me', 'us', 'mine', 'ours'])
const BOILER = /(\bMin Read\b|\bmin read\b|\bCredit\b|Cite this|Explanation:|Authors & editors|Tomorrow's picture|Browse past versions|Random APOD|A service of:)/

function genre(text) {
  const w = words(text)
  if (w.length < 80) return null
  // 문장 중간의 대문자 낱말 — 문장 첫 낱말은 뺀다
  const sentStarts = new Set()
  let idx = 0
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    const fw = (part.match(/[A-Za-z][A-Za-z'-]*/) ?? [null])[0]
    if (fw) sentStarts.add(idx)
    idx += words(part).length
  }
  let proper = 0
  w.forEach((x, i) => { if (/^[A-Z]/.test(x) && !sentStarts.has(i)) proper += 1 })
  return {
    first: w.filter((x) => FIRST.has(x.toLowerCase())).length / w.length,
    proper: proper / w.length,
    digits: (text.match(/\d/g) ?? []).length / text.length,
    boiler: BOILER.test(text) ? 1 : 0,
    n: w.length,
  }
}

// ── 기출 ────────────────────────────────────────────────────────────────────
const past = []
for (const r of allRows()) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (!p) continue
  const g = genre(p)
  if (g) past.push(g)
}

// ── 소스 덤프 ───────────────────────────────────────────────────────────────
const bySrc = {}
const bySrcText = {}
for (const f of dumps) {
  if (!fs.existsSync(f)) continue
  const raw = fs.readFileSync(f, 'utf8')
  const i = raw.indexOf('[{')
  const j = raw.lastIndexOf('}]')
  if (i < 0 || j <= i) continue
  let body = raw.slice(i, j + 2)
  if (body.includes('\\"')) body = JSON.parse('"' + body.replace(/"/g, '\\"').replace(/\\\\"/g, '\\"') + '"')
  let rows = []
  try { rows = JSON.parse(body) } catch { continue }
  for (const r of rows) {
    const g = genre(String(r.content ?? ''))
    if (!g) continue
    // 첫 덤프는 자체 작문(cefr 값), 둘째는 외부(source 를 별칭으로 넣었다)
    const key = /^(A2|B1|B2|C1)$/.test(String(r.cefr_level)) ? 'original(자체 작문)' : String(r.cefr_level)
    ;(bySrc[key] ??= []).push(g)
    ;(bySrcText[key] ??= []).push(String(r.content ?? ''))
  }
}

const med = (a, k) => { const s = a.map((x) => x[k]).sort((p, q) => p - q); return s[Math.floor(0.5 * (s.length - 1))] }
const share = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length

console.log('소스 장르 격차 — 난도만으로는 못 고른다')
console.log('='.repeat(78))
console.log(`  기출 읽기 지문 ${past.length}편`)
console.log('')
console.log('  집단                    n    1인칭    고유명사    숫자밀도   보일러플레이트')
console.log('  ' + '-'.repeat(74))
const pf = med(past, 'first')
const pp = med(past, 'proper')
const pd = med(past, 'digits')
const pb = share(past, 'boiler')
console.log(`  **기출**              ${String(past.length).padStart(4)}  ${(100 * pf).toFixed(2).padStart(6)}%  ${(100 * pp).toFixed(2).padStart(7)}%  ${(100 * pd).toFixed(2).padStart(7)}%  ${(100 * pb).toFixed(1).padStart(9)}%`)
const out = []
for (const [k, v] of Object.entries(bySrc).sort((a, b) => b[1].length - a[1].length)) {
  const row = { src: k, n: v.length, first: med(v, 'first'), proper: med(v, 'proper'), digits: med(v, 'digits'), boiler: share(v, 'boiler') }
  out.push(row)
  console.log(`  ${k.padEnd(20)} ${String(v.length).padStart(4)}  ${(100 * row.first).toFixed(2).padStart(6)}%  ${(100 * row.proper).toFixed(2).padStart(7)}%  ${(100 * row.digits).toFixed(2).padStart(7)}%  ${(100 * row.boiler).toFixed(1).padStart(9)}%`)
}

// 장르 게이트 — 기출 90분위 안에 드는가
const q90 = (a, k) => { const s = a.map((x) => x[k]).sort((p, q) => p - q); return s[Math.floor(0.9 * (s.length - 1))] }
const gF = q90(past, 'first')
const gP = q90(past, 'proper')
const gD = q90(past, 'digits')
console.log('')
console.log('  ⭐ 장르 게이트 — 기출 90분위 이하 + 보일러플레이트 없음')
console.log('  ' + '-'.repeat(74))
console.log(`    기준: 1인칭 ≤ ${(100 * gF).toFixed(2)}% · 고유명사 ≤ ${(100 * gP).toFixed(2)}% · 숫자 ≤ ${(100 * gD).toFixed(2)}% · 보일러 없음`)
const gate = []
for (const [k, v] of Object.entries(bySrc)) {
  const ok = v.filter((x) => x.first <= gF && x.proper <= gP && x.digits <= gD && !x.boiler).length
  gate.push({ src: k, n: v.length, pass: ok, rate: ok / v.length })
}
for (const g of gate.sort((a, b) => b.rate - a.rate)) {
  console.log(`    ${g.src.padEnd(20)} ${String(g.pass).padStart(3)}/${String(g.n).padEnd(4)} = ${(100 * g.rate).toFixed(1).padStart(5)}%`)
}

// ⭐ 세 관문의 교집합 — 난도 · 장르 · 라이선스
const LIC = { 'original(자체 작문)': 'cc0', nasa: 'public_domain', the_conversation: 'cc_by_nd', owid: 'cc_by', plos: 'cc_by', usgs: 'public_domain' }
const DERIV_OK = new Set(['cc0', 'public_domain', 'cc_by', 'cc_by_sa'])
const wordsOf = (t) => (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
console.log('')
console.log('  ⭐⭐ 세 관문 교집합 — 난도 AND 장르 AND 파생 가능')
console.log('  ' + '-'.repeat(74))
console.log('    난도 기준(§10): 평균 낱말 길이 ≥ 4.914 AND 8자 이상 낱말 ≥ 18.7%')
let allPass = 0
let allN = 0
for (const [k, v] of Object.entries(bySrcText)) {
  const lic = LIC[k] ?? '?'
  const ok = DERIV_OK.has(lic)
  let hard = 0
  let both = 0
  for (const t of v) {
    const w = wordsOf(t)
    if (w.length < 80) continue
    const wl = w.reduce((s2, x) => s2 + x.length, 0) / w.length
    const l8 = w.filter((x) => x.length >= 8).length / w.length
    const hardOk = wl >= 4.914 && l8 >= 0.187
    if (hardOk) hard += 1
    const g = genre(t)
    if (hardOk && g && g.first <= gF && g.proper <= gP && g.digits <= gD && !g.boiler && ok) both += 1
  }
  allN += v.length
  allPass += both
  console.log('    ' + k.padEnd(20) + ' 난도 ' + String(hard).padStart(3) + '  ·  라이선스 ' + (ok ? '가능 ' : '**불가**') + '  ·  **셋 다 ' + both + '/' + v.length + '**')
}
console.log('')
console.log('    → **세 관문을 동시에 통과: ' + allPass + '/' + allN + '**')
console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
console.log('    · **난도 게이트와 장르 게이트는 서로 다른 소스를 통과시킨다.**')
console.log('      자체 작문은 장르는 맞고 난도가 0%, 외부 수집은 난도는 맞고 장르가 걸린다.')
console.log('    · ⚠️ 이 지표는 **장르의 대리**다. "논지가 있는가" 는 직접 못 잰다 —')
console.log('      여기서 재는 것은 **명백히 아닌 것을 걸러 내는 하한**이다.')

fs.writeFileSync(path.join(DIR, 'source-genre.json'), JSON.stringify({
  pastN: past.length, past: { first: pf, proper: pp, digits: pd, boiler: pb },
  bySource: out, gate, thresholds: { first: gF, proper: gP, digits: gD },
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'source-genre.json')}`)
