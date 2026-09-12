// scripts/csat/score-bait-blind.mjs
//
// **배점을 붙여 손판독을 채점한다.**
//
// 판독은 `bait-blind.md` 를 **배점을 가린 채** 읽고 했다.
// 각 문항에서 **가장 강한 미끼 하나**를 고르고, 그것이 무엇을 무는지 판정했다:
//
//   **A형** — 미끼가 **정답과 의미가 가깝다** (같은 뜻 다른 낱말 포함)
//   **B형** — 미끼가 **지문 내용을 문다** (지문의 개념·표현을 재사용)
//
// 문헌의 표준 모형은 A형(key↔distractor 혼동)이다.
// §6.12 는 **어휘** 유사도로 B형이 우세함을 봤다. 이 판독은 **의미** 수준에서 같은지 본다.
//
// 실행: pnpm dlx tsx scripts/csat/score-bait-blind.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fisher, binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const key = JSON.parse(fs.readFileSync(path.join(DIR, 'bait-blind-key.json'), 'utf8'))

/**
 * Claude Code 손판독 (2026-08-25) — 배점을 보지 않고 판정했다.
 * 값은 가장 강한 미끼가 무는 대상: 'A' = 정답을 문다 · 'B' = 지문을 문다.
 * 근거는 각 줄 주석에 적는다(재검증 가능해야 한다).
 */
const JUDGMENT = {
  1: 'B',  // 2026#33  ⑤ "share their perspectives" ← 지문의 perspectives 반복
  2: 'B',  // M2706#32 ③ "interpret nonverbal behavior" ← 지문 "easy to misinterpret"
  3: 'A',  // M2706#40 ③ overlook≈disregard · ① marginalized≈underserved
  4: 'B',  // 2020#21  ③④ "music/musical" ← 지문의 재즈·음악이론
  5: 'B',  // 2020#33  ④ "resource supplies" ← 지문 "resource demands/limited supplies"
  6: 'A',  // 2020#40  ⑤ disconnected≈parted · ④ tied 공유(격자)
  7: 'B',  // 2018#23  ② "Writers or Publishers" ← 지문의 starving writers/publishing companies
  8: 'B',  // 2018#31  ③ "the Vietnam War" ← 지문 "set in Vietnam"
  9: 'B',  // 2024#21  ② "broadening one's perspective" ← 지문 "widened focus/broader perspective"
  10: 'A', // 2024#32  ④ "orients audiences to the film's theme" ≈ "aids viewer access"
  11: 'B', // 2015#23  ① "Possible from the Impossible" ← 지문 "impossible mountain"
  12: 'B', // 2015#32  ⑤ "cure social ills" ← 지문 "social ills of the world" 그대로
  13: 'B', // 2021#33  ③ "strengthening recent memories" ← 지문 "stabilized and strengthened"
  14: 'B', // 2014A#34 ③ "size of the TV screen" ← 지문의 TV 비유 그대로
  15: 'B', // 2019#32  ② "majority brings about social change" ← 지문 "lead to social change"(주어 반전)
  16: 'A', // M2609#21 ⑤ "notes with the same name" ≈ 정답 "named the same"
  17: 'B', // 2025#32  ⑤ "requires one to have the experience" ← 지문 "for the inexperienced"
  18: 'A', // 2025#40  ③ manageability≈controllability · ⑤ question≈challenge
  19: 'B', // 2016#34  ③ "immortality in literature" ← 지문 "earthly immortality/live forever on the page"
  20: 'A', // 2016#40  ① contextual 공유(격자)가 가장 강한 끌림
  21: 'B', // M2606#34 ⑤ "authority ... territories" ← 지문 "political organization of territory"
  22: 'B', // 2022#24  ② "Create, Modify, Transform" ← 지문 "customizing/modifying or transforming"
  23: 'A', // 2022#34  ⑤ "correctness and reliability" ≈ 정답 "certainty and precision"
  24: 'B', // 2014B#33 ③ "free from the inequalities of policymaking" ← 지문 표현 그대로(방향 반전)
}

const rows = key.items.map((it) => ({ ...it, bait: JUDGMENT[it.idx] }))
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

const B = rows.filter((r) => r.bait === 'B').length
const A = rows.filter((r) => r.bait === 'A').length

console.log('오답 미끼 — 의미 수준 손판독 (배점 가림)')
console.log('='.repeat(72))
console.log(`  표본 ${rows.length}문항 · 판독자: Claude Code · 배점은 판독 뒤에 붙였다`)
console.log()
console.log('  ① 미끼가 무는 대상')
console.log('  ' + '-'.repeat(68))
console.log(`    B형 — **지문**을 문다      ${B}/${rows.length} = ${pct(B, rows.length)}%`)
console.log(`    A형 — **정답**과 가깝다    ${A}/${rows.length} = ${pct(A, rows.length)}%`)
console.log()
console.log(`    귀무가설(둘이 반반)에서 이항 p = ${binomUpper(rows.length, B, 0.5).toFixed(5)}`)
console.log()
console.log('  → 문헌의 표준 모형은 **A형**(key↔distractor 혼동)이다.')
console.log('    의미 수준 판독에서도 **B형이 우세**하면 §6.12 의 어휘 결과가 재현된 것이다.')
console.log()

// ── ② 배점과의 관계 ──────────────────────────────────────────────────
const p3 = rows.filter((r) => r.points === 3), p2 = rows.filter((r) => r.points === 2)
const b3 = p3.filter((r) => r.bait === 'B').length, b2 = p2.filter((r) => r.bait === 'B').length
console.log('  ② 배점별 (판독 뒤에 붙였다)')
console.log('  ' + '-'.repeat(68))
console.log(`    3점  B형 ${b3}/${p3.length} = ${pct(b3, p3.length)}%`)
console.log(`    2점  B형 ${b2}/${p2.length} = ${pct(b2, p2.length)}%`)
const pf = fisher(b3, p3.length - b3, b2, p2.length - b2)
console.log(`    Fisher p = ${pf.toFixed(4)}`)
console.log()

console.log('  ③ 유형별')
console.log('  ' + '-'.repeat(68))
const byType = {}
for (const r of rows) { const t = (byType[r.type] ??= { n: 0, b: 0 }); t.n += 1; if (r.bait === 'B') t.b += 1 }
for (const [t, v] of Object.entries(byType)) console.log(`    ${t.padEnd(12)} B형 ${v.b}/${v.n} = ${pct(v.b, v.n)}%`)
console.log()

console.log('  판정')
console.log('  ' + '-'.repeat(68))
if (binomUpper(rows.length, B, 0.5) < 0.05) {
  console.log('  → **의미 수준에서도 미끼는 지문을 문다.** §6.12 의 어휘 결과가 재현됐다.')
  console.log('    수능의 오답 설계는 문헌의 key↔distractor 모형과 다르다.')
} else {
  console.log('  → B형 우세가 유의하지 않다. 어휘 결과가 의미 수준에서 재현되지 않았다.')
}
console.log()
console.log('  ⚠️ 한계')
console.log('    · 판독자가 **한 명**(Claude Code)이다. 두 번째 판독자와의 일치율을 못 냈다.')
console.log('    · 미끼를 하나만 고르게 했다. 실제로는 A·B 를 겸하는 오답이 있다(9·16번이 그랬다).')
console.log('    · 표본 24 — 배점별 비교는 12 vs 12 라 검정력이 낮다.')

fs.writeFileSync(path.join(DIR, 'bait-blind-score.json'), JSON.stringify({
  n: rows.length, B, A, pBinom: binomUpper(rows.length, B, 0.5),
  byPoints: { p3: { n: p3.length, B: b3 }, p2: { n: p2.length, B: b2 }, fisher: pf },
  byType, rows,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'bait-blind-score.json')}`)
