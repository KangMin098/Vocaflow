// scripts/verify-book-difficulty.mjs
//
// 도서 난이도 v2 정확도 검증 하니스 (재사용 QA 자산).
//
// "100% 정확"은 ground truth(학습자 성과) 없이는 불가 → 3중 검증으로 정확도를 확인:
//   1) 수렴 검증(Convergent) — v2.2 ↔ CEFR-J ↔ F-K ↔ old(p75) 독립 추정기 일치도(MAE·±1 이내율).
//      독립 추정기들이 수렴할수록 신뢰. VRL/CEFR-J/F-K는 서로 다른 데이터·방법.
//   2) 외부 앵커(Anchor) — 고전의 published 난이도 consensus(V-range)에 v2.2가 들어오는가.
//      인간이 확립한 레벨과 대조 = ground truth 근사.
//   3) 확신 계층(Confidence-stratified) — 고확신 책이 앵커/CEFR-J와 더 잘 맞는가.
//      맞다면 confidence가 accuracy를 예측 = 저확신 플래그 메커니즘 유효.
//
// 사용: node scripts/verify-book-difficulty.mjs

import { makeClient } from './dict-common.mjs'

const sb = makeClient()
const clamp = (x, lo = 0, hi = 11) => Math.max(lo, Math.min(hi, x))
const CJ = { preA1: 0, 'A1.1': 1, 'A1.2': 1, 'A1.3': 2, 'A2.1': 3, 'A2.2': 4, 'B1.1': 5, 'B1.2': 6, 'B2.1': 7, 'B2.2': 8, C1: 9, C2: 11 }
const fkV = (fk) => clamp((fk - 2) * 0.62)

// ── 외부 앵커: 고전의 published 난이도 consensus (Lexile/grade 기반 V-range) ──
// 근거: 널리 인용되는 Lexile·학년 레벨을 한국 학습자 V-scale(0-11)로 환산한 합의 범위.
const ANCHORS = [
  { m: /alice.*wonderland/i, lo: 5, hi: 6, note: 'children classic, easy-moderate' },
  { m: /wonderful wizard of oz/i, lo: 5, hi: 6, note: 'easy children narrative' },
  { m: /railway children/i, lo: 5, hi: 6, note: 'children' },
  { m: /wind in the willows/i, lo: 6, hi: 7, note: 'children-adult' },
  { m: /sherlock/i, lo: 6, hi: 7, note: 'detective, moderate' },
  { m: /huckleberry finn/i, lo: 6, hi: 7, note: 'dialect but readable' },
  { m: /great expectations/i, lo: 8, hi: 9, note: 'hard Victorian' },
  { m: /jane eyre/i, lo: 8, hi: 9, note: 'hard Victorian' },
  { m: /pride and prejudice/i, lo: 8, hi: 9, note: 'hard Austen' },
  { m: /decline/i, lo: 10, hi: 11, note: 'scholarly, hardest' },
]

const { data } = await sb
  .from('library_books')
  .select('title, book_v_level, vrl_components, flesch_kincaid_grade, cefrj_level')
  .eq('status', 'published')
const B = data ?? []

// 각 책의 추정기 값
const rows = B.map((b) => {
  const v2 = b.vrl_components?.difficulty_v2?.v ?? null
  const conf = b.vrl_components?.difficulty_v2?.confidence ?? null
  const old = b.vrl_components?.book_v_level_v1 ?? b.book_v_level // v1 = 변경 전 원본
  const cur = b.book_v_level
  const cj = CJ[b.cefrj_level] ?? null
  const fk = b.flesch_kincaid_grade != null ? Math.round(fkV(b.flesch_kincaid_grade)) : null
  return { title: b.title ?? '', v2, conf, old, cur, cj, fk }
})

// ── 1) 수렴 검증 ──
function mae(pairs) {
  const v = pairs.filter(([a, b]) => a != null && b != null)
  return v.length ? [v.reduce((s, [a, b]) => s + Math.abs(a - b), 0) / v.length, v.filter(([a, b]) => Math.abs(a - b) <= 1).length / v.length, v.length] : [null, null, 0]
}
console.log('═══ 1) 수렴 검증 — 독립 추정기 일치 (MAE · ±1이내율)')
const combos = [
  ['v2.2 ↔ CEFR-J', rows.map((r) => [r.v2, r.cj])],
  ['v2.2 ↔ F-K', rows.map((r) => [r.v2, r.fk])],
  ['old(p75) ↔ CEFR-J', rows.map((r) => [r.old, r.cj])],
  ['old(p75) ↔ F-K', rows.map((r) => [r.old, r.fk])],
]
for (const [label, pairs] of combos) {
  const [m, w1, n] = mae(pairs)
  console.log(`  ${label.padEnd(20)} MAE ${m?.toFixed(2)}V · ±1 ${(w1 * 100).toFixed(0)}% (n=${n})`)
}
console.log('  → v2.2가 old보다 CEFR-J/F-K에 가까우면 정확도 개선.')

// ── 2) 외부 앵커 검증 ──
console.log('\n═══ 2) 외부 앵커 — published 난이도 consensus 범위 적중')
let hit = 0, tot = 0, hitOld = 0
for (const a of ANCHORS) {
  const r = rows.find((x) => a.m.test(x.title))
  if (!r || r.v2 == null) continue
  tot++
  const inV2 = r.v2 >= a.lo && r.v2 <= a.hi
  const inOld = r.old >= a.lo && r.old <= a.hi
  if (inV2) hit++
  if (inOld) hitOld++
  console.log(`  ${r.title.slice(0, 26).padEnd(26)} 앵커 V${a.lo}-${a.hi} · v2=${r.v2}${inV2 ? '✓' : '✗'} old=${r.old}${inOld ? '✓' : '✗'}`)
}
console.log(`  적중률 — v2.2: ${hit}/${tot} (${((hit / tot) * 100).toFixed(0)}%) vs old: ${hitOld}/${tot} (${((hitOld / tot) * 100).toFixed(0)}%)`)

// ── 3) 확신 계층 정확도 ──
console.log('\n═══ 3) 확신 계층 — confidence가 accuracy 예측?')
const withCj = rows.filter((r) => r.v2 != null && r.cj != null && r.conf != null)
const hi = withCj.filter((r) => r.conf >= 0.7)
const lo = withCj.filter((r) => r.conf < 0.7)
const grpMae = (g) => (g.length ? (g.reduce((s, r) => s + Math.abs(r.v2 - r.cj), 0) / g.length).toFixed(2) : 'n/a')
console.log(`  고확신(≥0.7) ${hi.length}권 CEFR-J MAE ${grpMae(hi)}V`)
console.log(`  저확신(<0.7) ${lo.length}권 CEFR-J MAE ${grpMae(lo)}V`)
console.log(`  → 고확신 MAE < 저확신 MAE 이면 confidence가 정확도 예측(플래그 메커니즘 유효).`)

// ── 종합 판정 ──
const [m22cj] = mae(rows.map((r) => [r.v2, r.cj]))
const [moldcj] = mae(rows.map((r) => [r.old, r.cj]))
console.log('\n═══ 판정')
console.log(`  · v2.2 CEFR-J MAE ${m22cj?.toFixed(2)}V ${m22cj < moldcj ? '<' : '≥'} old ${moldcj?.toFixed(2)}V ${m22cj < moldcj ? '(개선✓)' : '(비개선)'}`)
console.log(`  · 앵커 적중 v2.2 ${((hit / tot) * 100).toFixed(0)}% ${hit >= hitOld ? '≥' : '<'} old ${((hitOld / tot) * 100).toFixed(0)}%`)
console.log(`  · 고확신 MAE ${grpMae(hi)}V vs 저확신 ${grpMae(lo)}V (확신 예측력)`)
console.log('  ⇒ 100% 확정은 저확신 플래그의 인간 검토 + 학습자 성과(IRT) 축적으로 수렴.')
