// scripts/textbook/coverage.mjs
//
// **커버리지를 세 축으로 찍는다** — 수능 유형 · 학교급 유형 · 지문 출처.
//
// "시중 교재 100% 커버리지" 를 말하려면 분모가 있어야 한다. 분모는 시중 교재가 아니라
// **수능·학교 유형 자체**다 — 시중 교재가 그것을 모사하므로 원본을 기준 삼는 편이
// 더 엄격하고, 문항 유형은 아이디어라 저작권 문제도 없다.
//
// ⚠️ 세 축을 섞지 않는다. "기출 빈칸" 과 "창작 빈칸" 은 **같은 유형이고 출처만 다르다** —
//   한 표에 뭉치면 커버리지가 부풀려진다.
//
// 재실행 안전: 읽기만 한다. DB 도 안 본다(정본이 코드에 있다).
//
// 실행: pnpm dlx tsx scripts/textbook/coverage.mjs

const {
  CSAT_READING_TYPES,
  measureCoverage,
  PRODUCTION_STAGES,
  measureStages,
  SCHOOL_TYPES,
  measureSchoolCoverage,
  PASSAGE_ORIGINS,
  measureOrigins,
} = await import('@vocaflow/library-pipeline')

const line = (n = 76) => '─'.repeat(n)
const pct = (r) => (100 * r).toFixed(1) + '%'
const GEN = { deterministic: '결정론', generative: '생성', external: '외부재료' }

// ── ① 수능 읽기 유형 ────────────────────────────────────────────────
const c = measureCoverage()
console.log('① 수능 영어 읽기 유형 (18~45번)\n')
console.log(`  유형   ${c.types.implemented}/${c.types.total}  = ${pct(c.types.ratio)}`)
console.log(`  문항   ${c.questions.implemented}/${c.questions.total}  = ${pct(c.questions.ratio)}   ← 시험지 비중\n`)

console.log(['  ', '번호'.padEnd(14), '유형'.padEnd(24), '방식'].join(' '))
for (const t of CSAT_READING_TYPES) {
  console.log(
    [t.implemented ? '✅' : '  ', t.numbers.join(',').padEnd(14), t.label.padEnd(24), GEN[t.generation]].join(' '),
  )
}
console.log('\n  방식별: ' + Object.entries(c.byGeneration).map(([k, v]) => `${GEN[k]} ${v.implemented}/${v.total}`).join(' · '))
console.log('\n  **결정론인데 아직 없는 것** — 다음에 만들 것:')
for (const t of c.deterministicGap) console.log(`    · ${t.label} (${t.numbers.join(',')}번)`)

// ── ② 초·중·고 내신 유형 ────────────────────────────────────────────
const sc = measureSchoolCoverage()
const BAND = { elementary: '초등', middle: '중등', high_naesin: '고내신' }
const MODE = { choice: '객관식', short: '단답', written: '서술형(사람채점)' }
const NEED = { any: '아무 지문', own_textbook: '본교 교과서', narrative: '서사', media: '그림·음원', none: '지문 불필요' }

console.log(`\n${line()}\n② 초·중·고 내신 유형\n`)
for (const [b, v] of Object.entries(sc.byBand)) console.log(`  ${BAND[b].padEnd(8)} ${v.implemented}/${v.total}`)
console.log(`  ${'자동 채점 가능'.padEnd(8)} ${sc.autoGradable.implemented}/${sc.autoGradable.total}   ← 서술형은 분모 밖(사람이 채점)\n`)

console.log(['  ', '밴드'.padEnd(8), '유형'.padEnd(24), '채점'.padEnd(18), '필요한 지문'].join(' '))
for (const t of SCHOOL_TYPES) {
  console.log(
    [t.implemented ? '✅' : '  ', BAND[t.band].padEnd(8), t.label.padEnd(24), MODE[t.answerMode].padEnd(18), NEED[t.sourceNeed]].join(' '),
  )
}

console.log('\n  **가장 싸게 만들 수 있는 유형** (결정론 · 자동채점 · 지문 제약 없음):')
for (const t of sc.cheapWins) console.log(`    · [${BAND[t.band]}] ${t.label}`)
console.log('\n  **우리가 공급할 수 없는 것** (BYO 전용):')
for (const t of sc.byoOnly) console.log(`    · [${BAND[t.band]}] ${t.label}`)

// ── ③ 지문 출처 — 유형과 다른 축 ────────────────────────────────────
const o = measureOrigins()
const RIGHT = { clear: '✅ 쓸 수 있음    ', conditional: '⚠  조건 확인 필요', user_supplied: '◐  사용자가 넣어야', blocked: '❌ 불가         ' }
console.log(`\n${line()}\n③ 지문 출처 — **유형과 다른 축이다**\n`)
for (const x of PASSAGE_ORIGINS) {
  console.log(`  ${RIGHT[x.right]}  ${x.label}`)
  if (x.ours.length) console.log(`       우리: ${x.ours.join(' · ')}`)
}
console.log(`\n  조건 없이 쓸 수 있는 것: ${o.usable.map((x) => x.label).join(' · ')}`)
console.log(`  확인이 남은 것: ${o.needsCheck.map((x) => x.label).join(' · ')}`)

// ── ④ 상업 교재 제작 단계 ───────────────────────────────────────────
const s = measureStages()
const STATE = { done: '✅', partial: '◐ ', missing: '❌' }
console.log(`\n${line()}\n④ 상업 교재 제작 8단계  —  있음 ${s.done} · 일부 ${s.partial} · 없음 ${s.missing}\n`)
for (const st of PRODUCTION_STAGES) {
  console.log(`  ${STATE[st.state]} ${st.order}. ${st.label}`)
  if (st.ours.length) console.log(`        우리: ${st.ours.join(' · ')}`)
  if (st.gap) console.log(`        갭:  ${st.gap}`)
}
