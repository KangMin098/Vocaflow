// scripts/csat/test-thesis-marker.mjs
//
// **주제문은 역접 표지 뒤에 오는가 — 기저부터 낸다.**
//
// 앞 사이클에서 대의파악 4문항의 주제문을 짚었더니 **3개가 However·though 뒤**에 있었다.
// n=4 의 관찰이라 문서에 "아직 검증 안 함" 으로 적어 두었다. 여기서 제대로 건다.
//
// 이 저장소가 아홉 번 당한 착오가 바로 이 형태다 —
// **적중률만 보고 기저를 안 보는 것.** 그래서 순서를 뒤집는다:
//   1) 기저를 **먼저** 기계로 낸다 — 대의파악 지문에서 역접 표지를 단 문장의 비율
//   2) 그 다음에 주제문이 거기 걸리는 비율을 사람이 읽어 낸다
//
// 기저가 이미 높으면(예: 40%) 주제문이 75% 라도 lift 는 35%p 에 그친다.
// 기저가 낮으면(예: 12%) 같은 75% 가 훨씬 강한 신호가 된다. **기저를 모르면 해석이 안 된다.**
//
// 실행: pnpm dlx tsx scripts/csat/test-thesis-marker.mjs

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

// 역접 표지 — 문두 또는 문두 근처(첫 6단어 안)
const CONTRAST = /^(however|but|yet|nevertheless|nonetheless|still|instead|conversely|by contrast|in contrast|on the contrary|on the other hand|rather|although|though|even so|despite|in spite of)\b/i
const CONTRAST_MID = /^(?:\S+\s+){0,5}\b(however|though|instead|nevertheless|by contrast|on the other hand|rather)\b/i

const classified = R('classified.json')
const TARGETS = ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-SUMMARY', 'R-CLAIM', 'R-PURPOSE']

let totalSent = 0, marked = 0, passages = 0
const perType = new Map()
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && TARGETS.includes(r.type))) {
  const L = itemLines(q.exam, q.no)
  if (!L) continue
  const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
  if (ci <= 0) continue
  const s = sentences(clean(L.slice(1, ci).filter((l) => l.trim()).join(' ')))
  if (s.length < 4) continue
  passages += 1
  const t = perType.get(q.type) ?? { sent: 0, mark: 0, n: 0 }
  t.n += 1
  for (const x of s) {
    totalSent += 1; t.sent += 1
    if (CONTRAST.test(x) || CONTRAST_MID.test(x)) { marked += 1; t.mark += 1 }
  }
  perType.set(q.type, t)
}

const base = marked / totalSent
console.log('기저 — 대의파악 지문에서 역접 표지를 단 문장의 비율')
console.log('─'.repeat(70))
console.log(`  지문 ${passages}편 · 문장 ${totalSent}개 · 역접 표지 ${marked}개`)
console.log(`  **기저 = ${(100 * base).toFixed(1)}%**`)
console.log('')
console.log('  유형별')
for (const [t, v] of [...perType].sort((a, b) => b[1].sent - a[1].sent)) {
  console.log(`    ${t.padEnd(11)} 지문 ${String(v.n).padStart(2)} · 문장 ${String(v.sent).padStart(3)} · 표지 ${String(v.mark).padStart(3)} = ${(100 * v.mark / v.sent).toFixed(1)}%`)
}
console.log('')
console.log('  해석 기준')
console.log(`    주제문이 역접 뒤에 오는 비율을 사람이 읽어 내면, 그것을 이 ${(100 * base).toFixed(1)}% 와 비교한다.`)
console.log('    기저를 모르면 "3/4 가 역접 뒤" 라는 관찰은 해석이 불가능하다 —')
console.log('    지문의 절반이 역접 문장이라면 아무 문장이나 절반이 걸린다.')

fs.writeFileSync(path.join(OUT_DIR, 'thesis-marker-base.json'), JSON.stringify(
  { passages, totalSent, marked, base, perType: [...perType].map(([t, v]) => ({ type: t, ...v })) }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'thesis-marker-base.json')}`)
