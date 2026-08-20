// scripts/textbook/coverage.mjs
//
// **수능 유형 커버리지와 상업 교재 제작 단계 대비 상태를 찍는다.**
//
// "시중 교재 100% 커버리지" 를 말하려면 분모가 있어야 한다. 분모는 시중 교재가 아니라
// **수능 유형 자체**다 — 시중 교재가 그것을 모사하므로 원본을 기준 삼는 편이 더 엄격하고,
// 저작권 문제도 없다(문항 유형은 아이디어다).
//
// 재실행 안전: 읽기만 한다. DB 도 안 본다(정본이 코드에 있다).
//
// 실행: pnpm dlx tsx scripts/textbook/coverage.mjs

const { CSAT_READING_TYPES, measureCoverage, PRODUCTION_STAGES, measureStages } = await import(
  '@vocaflow/library-pipeline'
)

const c = measureCoverage()
const pct = (r) => (100 * r).toFixed(1) + '%'

console.log('수능 영어 읽기 유형 커버리지\n')
console.log(`  유형   ${c.types.implemented}/${c.types.total}  = ${pct(c.types.ratio)}`)
console.log(`  문항   ${c.questions.implemented}/${c.questions.total}  = ${pct(c.questions.ratio)}   ← 시험지에서 차지하는 비중\n`)

const MARK = { deterministic: '결정론', generative: '생성', external: '외부재료' }
console.log(['', '번호'.padEnd(12), '유형'.padEnd(22), '방식'.padEnd(8)].join(' '))
for (const t of CSAT_READING_TYPES) {
  console.log(
    [
      t.implemented ? '✅' : '  ',
      t.numbers.join(',').padEnd(12),
      t.label.padEnd(22),
      MARK[t.generation].padEnd(8),
    ].join(' '),
  )
}

console.log('\n방식별:')
for (const [k, v] of Object.entries(c.byGeneration)) {
  console.log(`  ${MARK[k].padEnd(8)} ${v.implemented}/${v.total}`)
}

console.log('\n**결정론으로 가능한데 아직 없는 것** — 다음에 만들 것:')
for (const t of c.deterministicGap) console.log(`  · ${t.label} (${t.numbers.join(',')}번) — ${t.note}`)

const s = measureStages()
console.log(`\n${'─'.repeat(76)}\n상업 교재 제작 8단계 대비  —  있음 ${s.done} · 일부 ${s.partial} · 없음 ${s.missing}\n`)
const STATE = { done: '✅', partial: '◐ ', missing: '❌' }
for (const st of PRODUCTION_STAGES) {
  console.log(`${STATE[st.state]} ${st.order}. ${st.label}`)
  if (st.ours.length) console.log(`      우리: ${st.ours.join(' · ')}`)
  if (st.gap) console.log(`      갭:  ${st.gap}`)
}
