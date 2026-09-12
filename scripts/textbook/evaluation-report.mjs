// scripts/textbook/evaluation-report.mjs
//
// **시중 교재 대비 평가 요소 대조표.**
//
// 목표가 "시중 교재보다 평가 우위" 라면 **분모가 있어야 한다.** 그 분모는 교재 평가
// 4대 대범주(법령·규범 및 공정성 · 외형 및 실용성 · 교육과정의 준수 · 교육 방법 및 내용)와
// 시장이 실제로 고르는 기준(해설 깊이 · 수준별 구성 · 시험 유형 반영)이다.
//
// ⚠️ **근거 없이 우위라고 적지 않는다.** 요소마다 어떻게 쟀는지가 함께 나오고,
//   못 잰 것은 `못 잼` 으로 남는다 — 우위로도 열위로도 세지 않는다.
//
// 재실행 안전: 읽기만 한다. DB 도 안 본다(정본이 코드에 있다).
// 실행: pnpm dlx tsx scripts/textbook/evaluation-report.mjs

const { EVAL_DIMENSIONS, CATEGORY_KO, measureEvaluation } = await import('@vocaflow/library-pipeline')

const r = measureEvaluation()
const line = '─'.repeat(78)
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(0) + '%' : '—')

const MARK = {
  superior: '🟢 우위',
  parity: '⚪ 대등',
  inferior: '🔴 열위',
  absent: '⛔ 없음',
  unmeasured: '❔ 못 잼',
}

console.log(`${line}\n시중 교재 대비 평가 요소 — ${r.total}개\n`)
console.log(
  `  🟢 우위 ${r.byStanding.superior} · ⚪ 대등 ${r.byStanding.parity} · ` +
    `🔴 열위 ${r.byStanding.inferior} · ⛔ 없음 ${r.byStanding.absent} · ❔ 못 잼 ${r.byStanding.unmeasured}`,
)
console.log(`  **우위율 ${pct(r.byStanding.superior, r.total)}**  (분모는 요소 전체 — 못 잰 것을 빼지 않는다)\n`)

for (const cat of ['legal', 'physical', 'curriculum', 'pedagogy']) {
  const dims = EVAL_DIMENSIONS.filter((d) => d.category === cat)
  const c = r.byCategory[cat]
  console.log(`${line}\n■ ${CATEGORY_KO[cat]}  —  우위 ${c.superior}/${c.total}\n`)
  for (const d of dims) {
    console.log(`  ${MARK[d.standing]}  ${d.label}`)
    console.log(`       시중: ${d.market}`)
    console.log(`       우리: ${d.ours}`)
    console.log(`       근거: ${d.howMeasured}`)
    console.log()
  }
}

console.log(line)
console.log(`\n■ 지고 있는 요소 ${r.losing.length}개 — 여기가 다음에 할 일이다\n`)
for (const d of r.losing) {
  console.log(`  ${MARK[d.standing]}  ${d.label}  (${CATEGORY_KO[d.category]})`)
  console.log(`       ${d.ours}`)
}

const unmeasured = EVAL_DIMENSIONS.filter((d) => d.standing === 'unmeasured')
if (unmeasured.length) {
  console.log(`\n■ 못 잰 요소 ${unmeasured.length}개 — **우위라고 주장하지 않는다**\n`)
  for (const d of unmeasured) console.log(`  ❔ ${d.label} — ${d.howMeasured}`)
}
