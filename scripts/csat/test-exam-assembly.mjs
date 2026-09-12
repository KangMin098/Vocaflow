// scripts/csat/test-exam-assembly.mjs
//
// **문항 하나씩 옳아도 회차로 모으면 틀릴 수 있다.**
//
// `verify-blueprint-items.mjs` 는 문항 단위 제약만 본다. 그것을 전부 통과한 37문항을
// 한 회차처럼 모아 보니 정답 번호가 **①0 ②9 ③11 ④13 ⑤4** 였다.
// 기출은 14개년 내내 45문항에서 **8~11** 로 균형이 잡혀 있다(E5). 즉 이 세트는
// 문항 규칙을 다 지키고도 **회차 규칙을 어긴다.**
//
// 원인은 분명했다 — 가족 제약 G1(대응형 ①회피)을 **대응형이 아닌 유형에까지** 적용했다.
// 그 오용은 이 저장소가 이미 경고해 둔 것이다: "1번은 잘 안 나온다" 를 전 유형에 적용하면
// 3분의 2에서 정확히 반대로 작동한다(G2 — 비대응형에서는 ①이 최빈 27%).
//
// 그래서 회차 수준 검사를 따로 만든다. 두 관문이다:
//   A1 정답 번호 균형 — 기출 비율(45문항 8~11 = 0.178~0.244)로 환산한 범위 안인가
//   A2 유형별 금지 자리 — 그 유형의 14개년 관측에서 **한 번도 정답이 아니었던 번호**를 쓰지 않았는가
//   A3 3점 비율 — 기출 10/45 = 22.2% 대비 ±1문항
//   A4 한글 선지 3점 0 (G3)
//
// 실행: node scripts/csat/test-exam-assembly.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const items = rd('blueprint-items.json').types
const cons = rd('type-constraints.json')
const inv = rd('type-inventory.json').rows.filter((r) => r.current)

const rows = inv.map((r) => ({ type: r.type, ...items[r.type] })).filter((x) => x.answer)
const n = rows.length

const dist = [0, 0, 0, 0, 0]
for (const r of rows) dist[r.answer - 1] += 1

// A1 — 기출 비율 환산
const LO = 8 / 45, HI = 11 / 45
const lo = Math.floor(LO * n), hi = Math.ceil(HI * n)
const a1 = dist.map((c, i) => ({ no: i + 1, c, ok: c >= lo && c <= hi }))

// A2 — 유형별로 14개년 관측에서 0회였던 자리
const a2 = []
for (const r of rows) {
  const s1 = cons.types[r.type]?.content?.find((x) => x.id === 'S1')
  if (!s1) continue
  if (s1.dist[r.answer - 1] === 0) a2.push({ type: r.type, answer: r.answer, dist: s1.dist, n: s1.n })
}

// A3 — 3점 비율
const high = rows.filter((r) => r.points === 3).length
const want = (10 / 45) * n
const a3 = Math.abs(high - want) <= 1

// A4 — 한글 선지 3점
const isKo = (s) => /[가-힣]/.test(s ?? '')
const a4 = rows.filter((r) => r.points === 3 && isKo((r.choices ?? []).join('')))

const pass = a1.every((x) => x.ok) && a2.length === 0 && a3 && a4.length === 0

console.log(`회차 조립 검사 — ${n}문항`)
console.log(`A1 정답 번호 균형 (허용 ${lo}~${hi}): ${a1.map((x) => `${x.no}:${x.c}${x.ok ? '' : '✗'}`).join(' ')}  ${a1.every((x) => x.ok) ? 'PASS' : 'FAIL'}`)
console.log(`A2 유형별 금지 자리(14개년 0회): ${a2.length ? 'FAIL' : 'PASS'}`)
for (const x of a2) console.log(`   ✗ ${x.type} 정답 ${x.answer} — 14개년 ${x.n}문항 분포 ${x.dist.join('/')} 에서 0회`)
console.log(`A3 3점 비율: ${high}문항 (기대 ${want.toFixed(1)}) ${a3 ? 'PASS' : 'FAIL'}`)
console.log(`A4 한글 선지 3점: ${a4.length ? `FAIL — ${a4.map((x) => x.type).join(' ')}` : 'PASS'}`)

fs.writeFileSync(path.join(DIR, 'exam-assembly.json'), JSON.stringify({
  n, dist, allow: { lo, hi }, a1, a2, high, wantHigh: +want.toFixed(2), a3, a4: a4.map((x) => x.type), pass,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'exam-assembly.json')}`)
process.exit(pass ? 0 : 1)
