// scripts/textbook/run-atomic-bridge.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'
import { exportOrderProductionDrain, importOrderProductionDrain } from '@vocaflow/library-pipeline/order-production-run'
import { produceRunAtomicVolume, syntheticTrustRoot } from './run-atomic-bridge.mjs'
import { verifyAtomicPlannedVolume } from './atomic-volume.mjs'

const h = c => c.repeat(64)
const policy = n => ({ version: `p${n}`, hash: h(n) })
const vLevel = grade => grade.startsWith('high') ? 7 : grade.startsWith('middle') ? 5 : 2
const band = grade => grade.startsWith('high') ? 'high' : grade.startsWith('middle') ? 'middle' : 'elementary'

function runInput(brief, trust, revision = 1) {
  const { plan_hash } = planProductBrief(brief)
  return { schema: 'textbook-order-production-input/1', sealed_at: '2026-10-07T00:00:00Z',
    drafts: brief.grade_scope.grades.map(grade => ({ brief, plan_hash, grade,
      product_order_id: `order-${grade}`, order_revision: revision, series_id: 'series', edition_id: 'ed1',
      product_variant: 'student', language_band: band(grade), passage_v_level: vLevel(grade), share_alike: false,
      unit_spec_version: 'u1', chapter_spec_version: 'c1', volume_spec_version: 'v1', layout_profile: 'reading-v1',
      policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'), benchmark: policy('4'),
        evidence: policy('5'), trust: { version: 'synthetic-trust', hash: trust.policy_hash } } })) }
}
// Stand-in for the agent drain: target-length passage with two distinct grounded sentences per cell.
function fill(drain) {
  return { cells: drain.cells.map(cell => {
    const filler = Array.from({ length: cell.passage_words_target - 12 }, (_, i) => `w${cell.day}x${i}`).join(' ')
    const passage = `Plants store energy in roots ${cell.grade} day ${cell.day}. ${filler} Rain refills the deep wells slowly.`
    const primary = `Plants store energy in roots ${cell.grade} day ${cell.day}.`
    return { cell_id: cell.cell_id, cell_hash: cell.cell_hash, passage, items: [{
      item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: `Day ${cell.day}: which statement is supported?`,
      choices: [primary, 'Wells never refill.'], answer: 1, explanation: '첫 문장이 그대로 말한다.',
      evidence_primary: primary, evidence_secondary: 'Rain refills the deep wells slowly.', focus_text: 'energy' }] }
  }) }
}
const brief = (family, grades) => ({ schema: 'textbook-product-brief/1',
  grade_scope: { mode: grades.length === 1 ? 'single_grade' : 'multi_grade', grades }, purpose: 'knowledge_reading',
  product_family: family, domain_weights: { science: 1 }, genre_weights: { explanation: 1 }, duration_days: 3,
  units_per_chapter: 3, difficulty: { start: 2, end: 3 }, passage_words: { start: 60, end: 70 }, source_strategy: 'balanced' })

for (const [family, grades] of [['P09', ['middle_1', 'high_3']], ['P05', ['elementary_5']], ['P03', ['high_1']], ['P12', ['middle_2', 'middle_3']]]) {
  test(`${family} ${grades.join('/')}: registered order run -> per-day atomic snapshots -> verified volume`, async () => {
    const trust = syntheticTrustRoot()
    const input = runInput(brief(family, grades), trust)
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    assert.equal(run.status, 'assembled', JSON.stringify(run.blockers))
    const produced = await produceRunAtomicVolume({ run, trust })
    assert.equal(produced.volume.manifest.sections.length, 3)
    assert.equal(produced.volume.manifest.production_verified, false)
    const runOrders = new Map(run.volumeInput.orders.map(o => [o.order.product_order_id, o.order_hash]))
    for (const section of produced.volume.manifest.sections) {
      assert.equal(section.units.length, grades.length)
      for (const unit of section.units) assert.equal(unit.order_hash, runOrders.get(unit.product_order_id))
    }
    produced.revoke(produced.snapshots[1])
    await assert.rejects(verifyAtomicPlannedVolume(produced.serveDb, produced.input, produced.volume), /SECTION_NOT_CURRENT/)
  })
}

test('a run sealed under a different trust policy cannot enter atomic production', async () => {
  const trust = syntheticTrustRoot(), other = syntheticTrustRoot()
  const input = runInput(brief('P07', ['high_2']), other)
  const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
  await assert.rejects(produceRunAtomicVolume({ run, trust }), /RUN_TRUST_POLICY_MISMATCH/)
})

test('every planned-path family reaches a verified atomic volume (single grade)', async () => {
  const families = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P15', 'P16', 'P17', 'P19']
  for (const family of families) {
    const trust = syntheticTrustRoot()
    const input = runInput(brief(family, ['middle_1']), trust)
    const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
    assert.equal(run.status, 'assembled', `${family} ${JSON.stringify(run.blockers)}`)
    const produced = await produceRunAtomicVolume({ run, trust })
    assert.equal(produced.volume.manifest.sections.length, 3, family)
  }
})

test('items changed after the run gate fail inside atomic production', async () => {
  const trust = syntheticTrustRoot()
  const input = runInput(brief('P09', ['middle_1']), trust)
  const run = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
  run.gatedItems[0].items[0].evidence_secondary = run.gatedItems[0].items[0].evidence_primary
  await assert.rejects(produceRunAtomicVolume({ run, trust }), /READING_FAMILY_SECONDARY_EVIDENCE_MISSING/)
  const other = importOrderProductionDrain(input, fill(exportOrderProductionDrain(input)))
  other.gatedItems[0].items[0].item_id = 'foreign'
  await assert.rejects(produceRunAtomicVolume({ run: other, trust }), /RUN_GATED_ITEMS_MISMATCH/)
})

test('specialized families stop before atomic production with the DB-gate reason', async () => {
  const trust = syntheticTrustRoot()
  const input = runInput(brief('P18', ['high_2']), trust)
  for (const draft of input.drafts) draft.exam = 'csat'
  const run = importOrderProductionDrain(input, { cells: exportOrderProductionDrain(input).cells.map(cell => ({
    cell_id: cell.cell_id, cell_hash: cell.cell_hash,
    passage: `Plants store energy in roots today. ${Array.from({ length: cell.passage_words_target - 6 }, (_, i) => `w${i}`).join(' ')}`,
    items: [{ item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: 'Which is supported?',
      choices: ['Plants store energy in roots today.', 'No.'], answer: 1, explanation: '근거 문장.',
      evidence_primary: 'Plants store energy in roots today.', time_limit_seconds: 90 }] })) })
  assert.equal(run.status, 'assembled', JSON.stringify(run.blockers))
  await assert.rejects(produceRunAtomicVolume({ run, trust }), /ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING/)
})
