// scripts/textbook/run-revision.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'
import { exportOrderProductionDrain, importOrderProductionDrain } from '@vocaflow/library-pipeline/order-production-run'
import { produceRunAtomicVolume, syntheticTrustRoot } from './run-atomic-bridge.mjs'
import { verifyAtomicPlannedVolume } from './atomic-volume.mjs'
import { inspectRunRevision, reviseRunAtomicVolume } from './run-revision.mjs'

const h = c => c.repeat(64)
const policy = n => ({ version: `p${n}`, hash: h(n) })
const brief = { schema: 'textbook-product-brief/1', grade_scope: { mode: 'multi_grade', grades: ['middle_1', 'high_3'] },
  purpose: 'knowledge_reading', product_family: 'P09', domain_weights: { science: 1 }, genre_weights: { explanation: 1 },
  duration_days: 3, units_per_chapter: 3, difficulty: { start: 2, end: 3 }, passage_words: { start: 60, end: 70 }, source_strategy: 'balanced' }
const input = (trust, revision = 1) => ({ schema: 'textbook-order-production-input/1', sealed_at: '2026-10-07T00:00:00Z',
  drafts: brief.grade_scope.grades.map(grade => ({ brief, plan_hash: planProductBrief(brief).plan_hash, grade,
    product_order_id: `order-${grade}`, order_revision: grade === 'high_3' ? revision : 1, series_id: 's', edition_id: 'e',
    product_variant: 'student', language_band: grade.startsWith('high') ? 'high' : 'middle',
    passage_v_level: grade.startsWith('high') ? 7 : 5, share_alike: false, unit_spec_version: 'u1',
    chapter_spec_version: 'c1', volume_spec_version: 'v1', layout_profile: 'reading-v1',
    policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'), benchmark: policy('4'),
      evidence: policy('5'), trust: { version: 't', hash: trust.policy_hash } } })) })
const fill = (drain, explain = () => '첫 문장이 말한다.') => ({ cells: drain.cells.map(cell => {
  const primary = `Plants store energy in roots ${cell.grade} day ${cell.day}.`
  const filler = Array.from({ length: cell.passage_words_target - 12 }, (_, i) => `w${cell.day}x${i}`).join(' ')
  return { cell_id: cell.cell_id, cell_hash: cell.cell_hash, passage: `${primary} ${filler} Rain refills the deep wells slowly.`,
    items: [{ item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: 'Which is supported?',
      choices: [primary, 'Wells never refill.'], answer: 1, explanation: explain(cell),
      evidence_primary: primary, evidence_secondary: 'Rain refills the deep wells slowly.' }] }
}) })

test('an explanation fix on one day rebuilds only that day and the old volume stops verifying', async () => {
  const trust = syntheticTrustRoot()
  const runInput = input(trust)
  const drain = exportOrderProductionDrain(runInput)
  const priorRun = importOrderProductionDrain(runInput, fill(drain))
  const prior = await produceRunAtomicVolume({ run: priorRun, trust })
  const nextRun = importOrderProductionDrain(runInput, fill(drain, cell =>
    cell.day === 2 && cell.grade === 'high_3' ? '고친 해설: 첫 문장이 직접 말한다.' : '첫 문장이 말한다.'))
  const impact = inspectRunRevision(priorRun, nextRun)
  assert.deepEqual(impact.rebuild_days, [2])
  assert.deepEqual(impact.reuse_days, [1, 3])
  assert.ok(impact.reasons['2'].includes('high_3:items'))
  assert.ok(impact.reasons['2'].every(reason => reason.startsWith('high_3:')))
  const revised = await reviseRunAtomicVolume({ priorRun, nextRun, prior, trust })
  const snaps = revised.produced.snapshots
  assert.equal(snaps[0], prior.snapshots[0])
  assert.equal(snaps[2], prior.snapshots[2])
  assert.notEqual(snaps[1], prior.snapshots[1])
  assert.equal(revised.produced.days[1].revision, 2)
  const affected = revised.day_impacts[0].impact.affected.map(row => row.artifact_id)
  assert.ok(affected.some(id => id.startsWith('explanation:')))
  assert.ok(affected.includes(`publication:${revised.produced.days[1].output.manifest.group_id}`))
  // The earlier volume referenced day 2 revision 1, which the new serve DB no longer publishes.
  await assert.rejects(verifyAtomicPlannedVolume(revised.produced.serveDb, prior.input, prior.volume), /SECTION_NOT_CURRENT/)
})

test('an order revision change rebuilds every day for that grade; nothing changed rebuilds nothing', async () => {
  const trust = syntheticTrustRoot()
  const runInput = input(trust)
  const priorRun = importOrderProductionDrain(runInput, fill(exportOrderProductionDrain(runInput)))
  const prior = await produceRunAtomicVolume({ run: priorRun, trust })
  const same = await reviseRunAtomicVolume({ priorRun, nextRun: priorRun, prior, trust })
  assert.equal(same.impact.volume_state, 'current')
  assert.equal(same.produced, prior)
  const revisedInput = input(trust, 2)
  const nextRun = importOrderProductionDrain(revisedInput, fill(exportOrderProductionDrain(revisedInput)))
  const impact = inspectRunRevision(priorRun, nextRun)
  assert.deepEqual(impact.rebuild_days, [1, 2, 3])
  assert.ok(impact.reasons['1'].includes('high_3:order_hash'))
  const revised = await reviseRunAtomicVolume({ priorRun, nextRun, prior, trust })
  assert.ok(revised.produced.volume.manifest.orders.some(o => o.grade === 'high_3' && o.order_revision === 2))
})

test('a run whose order set or plan changed is refused instead of partially reused', () => {
  const trust = syntheticTrustRoot()
  const runInput = input(trust)
  const run = importOrderProductionDrain(runInput, fill(exportOrderProductionDrain(runInput)))
  const other = structuredClone(run)
  other.volumeInput.orders[1].order.product_order_id = 'order-other'
  assert.throws(() => inspectRunRevision(run, other), /ORDER_SET_CHANGED/)
  const shorter = structuredClone(run)
  shorter.volumeInput.units.pop()
  assert.throws(() => inspectRunRevision(run, shorter), /PLAN_CHANGED/)
})
