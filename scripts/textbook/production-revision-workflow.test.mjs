// scripts/textbook/production-revision-workflow.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { hash } from './frym-benchmark/benchmark.mjs'
import { beginSyntheticRevisionWorkflow, advanceSyntheticRevisionWorkflow } from './production-revision-workflow.mjs'

const h = char => char.repeat(64)
const sealed = body => ({ ...body, manifest_hash: hash(body) })
function manifest(itemDigest = h('a')) {
  return sealed({ schema: 'textbook-multi-grade-factory-dry-run/1',
    group_id: 'revision-test', group_hash: h('b'), evidence_hash: h('c'), plan_hash: h('d'),
    units: [{ unit_id: 'unit-m1', grade: 'middle_1', product_order_id: 'order-m1',
      order_revision: 1, order_hash: h('e'), source_id: 'source', source_hash: h('f'),
      rights_hash: h('1'), passage_hash: h('2'), adaptation_hash: h('3'),
      benchmark_snapshot_hash: h('4'), unit_content_hash: h('5') }],
    item_evidence: [{ grade: 'middle_1', item_id: 'item-1', item_digest: itemDigest,
      explanation_hash: h('6') }] })
}
const event = (event_id, type, proof_hash = h('7')) => ({
  event_id, type, proof_hash, group_id: 'revision-test',
  next_manifest_hash: manifest(h('8')).manifest_hash,
})

test('changed item runs review, rebuild and republish simulation with immutable manifest binding', () => {
  const start = beginSyntheticRevisionWorkflow(manifest(), manifest(h('8')))
  assert.equal(start.state, 'needs_review')
  assert.equal(start.synthetic_fixture && start.non_production, true)
  assert(start.affected.some(row => row.artifact_id === 'publication:revision-test' && row.proposed_state === 'stale'))
  const reviewed = advanceSyntheticRevisionWorkflow(start, event('review-1', 'review_approved'))
  assert.equal(reviewed.state, 'revise')
  assert.equal(advanceSyntheticRevisionWorkflow(reviewed, event('review-1', 'review_approved')).workflow_hash,
    reviewed.workflow_hash)
  const rebuilt = advanceSyntheticRevisionWorkflow(reviewed, event('build-1', 'rebuild_passed', h('9')))
  assert.equal(rebuilt.state, 'republish')
  assert.throws(() => advanceSyntheticRevisionWorkflow(rebuilt, { ...event('publish-1', 'publication_simulated', h('0')),
    output_hash: h('0') }), /OUTPUT_MISMATCH/)
  const complete = advanceSyntheticRevisionWorkflow(rebuilt, { ...event('publish-1', 'publication_simulated', h('9')),
    output_hash: h('9') })
  assert.equal(complete.state, 'complete')
  assert.equal(complete.publish_eligible, false)
  assert.throws(() => advanceSyntheticRevisionWorkflow(complete, event('extra', 'review_approved')), /TERMINAL/)
})

test('failed rebuild returns to review without preserving a false success', () => {
  const start = beginSyntheticRevisionWorkflow(manifest(), manifest(h('8')))
  const reviewed = advanceSyntheticRevisionWorkflow(start, event('review-1', 'review_approved'))
  const failed = advanceSyntheticRevisionWorkflow(reviewed, event('failed-1', 'rebuild_failed'))
  assert.equal(failed.state, 'needs_review')
  assert.equal(failed.events.length, 2)
  assert.throws(() => advanceSyntheticRevisionWorkflow(failed, event('failed-1', 'review_approved')),
    /REPLAY_CONFLICT/)
  assert.equal(advanceSyntheticRevisionWorkflow(failed, event('review-2', 'review_approved')).state, 'revise')
})

test('rights revocation withdraws; tamper, mixed run and no-change are rejected', () => {
  const withdrawn = beginSyntheticRevisionWorkflow(manifest(), manifest(), 'rights_revoked')
  assert.equal(withdrawn.state, 'withdraw')
  assert(withdrawn.affected.every(row => row.proposed_state === 'invalidated'))
  assert.throws(() => advanceSyntheticRevisionWorkflow(withdrawn, event('review', 'review_approved')), /TERMINAL/)
  const changed = beginSyntheticRevisionWorkflow(manifest(), manifest(h('8')))
  const forgedBody = { ...changed, publish_eligible: true }
  delete forgedBody.workflow_hash
  const forged = { ...forgedBody, workflow_hash: hash(forgedBody) }
  assert.throws(() => advanceSyntheticRevisionWorkflow(forged, event('review', 'review_approved')),
    /TAMPERED/)
  assert.throws(() => advanceSyntheticRevisionWorkflow({ ...changed, state: 'complete' }, event('review', 'review_approved')),
    /TAMPERED/)
  assert.throws(() => advanceSyntheticRevisionWorkflow(changed, { ...event('review', 'review_approved'),
    group_id: 'other-run' }), /EVENT_INVALID/)
  assert.throws(() => beginSyntheticRevisionWorkflow(manifest(), manifest()), /NO_CHANGE/)
})
