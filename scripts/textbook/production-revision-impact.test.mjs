// scripts/textbook/production-revision-impact.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { hash } from './frym-benchmark/benchmark.mjs'
import { inspectProductionRevisionImpact, validateProductionRevisionManifest } from './production-revision-impact.mjs'

const h = c => c.repeat(64)
function sealed(body) { return { ...body, manifest_hash: hash(body) } }
function manifest() {
  const units = ['m1', 'h1'].map((grade, i) => ({
    unit_id: `unit-${grade}`, grade, product_order_id: `order-${grade}`,
    order_revision: 1, order_hash: h(i ? '1' : '2'), source_id: 'source-f02',
    source_hash: h('3'), rights_hash: h('4'), passage_hash: h(i ? '5' : '6'),
    adaptation_hash: h(i ? '7' : '8'), benchmark_snapshot_hash: h('9'),
    unit_content_hash: h(i ? 'a' : 'b'),
  }))
  return sealed({ schema: 'textbook-multi-grade-factory-dry-run/1',
    evidence_level: 'atomic_snapshot_unpublished', group_id: 'group-f02',
    group_hash: h('c'), evidence_hash: h('d'), plan_hash: h('e'), units,
    item_evidence: ['m1', 'h1'].map((grade, i) => ({ grade,
      item_id: `item-${grade}`, item_digest: h(i ? 'f' : '0'),
      explanation_hash: h(i ? '1' : '2') })) })
}

test('runtime impact inspection propagates a source revision across grade units and render', () => {
  const old = manifest()
  const { manifest_hash: _ignored, ...body } = old
  const next = sealed({ ...body, units: old.units.map(unit => ({ ...unit, source_hash: h('7') })) })
  const affected = inspectProductionRevisionImpact(old, next).affected.map(row => row.artifact_id)
  assert(affected.includes('source:source-f02'))
  assert(affected.includes('unit:m1'))
  assert(affected.includes('unit:h1'))
  assert(affected.includes('render:group-f02'))
  assert(affected.every(id => !id.startsWith('source:other')))
})

test('one grade item revision affects only its grade before whole-volume invalidation', () => {
  const old = manifest()
  const { manifest_hash: _ignored, ...body } = old
  const next = sealed({ ...body, evidence_hash: h('7'), item_evidence: old.item_evidence.map(item =>
    item.grade === 'm1' ? { ...item, item_digest: h('f') } : item) })
  const affected = inspectProductionRevisionImpact(old, next).affected.map(row => row.artifact_id)
  assert(affected.includes('item:item-m1'))
  assert(affected.includes('unit:m1'))
  assert(!affected.includes('unit:h1'))
  assert(affected.includes('volume:group-f02'))
})

test('revocation invalidates even if the prior bytes still match', () => {
  const old = manifest()
  const affected = inspectProductionRevisionImpact(old, old, 'rights_revoked').affected
  assert(affected.length > 2)
  assert(affected.every(row => row.proposed_state === 'invalidated' && row.authorized === false))
})

test('tampering and another run cannot be inspected as one revision', () => {
  const old = manifest()
  assert.throws(() => inspectProductionRevisionImpact({ ...old, group_hash: h('0') }, old),
    /MANIFEST_TAMPERED/)
  const { manifest_hash: _ignored, ...body } = old
  const other = sealed({ ...body, group_id: 'another-run' })
  assert.throws(() => inspectProductionRevisionImpact(old, other), /GROUP_MIXED/)
})

test('a self-hashed but graph-invalid previous manifest fails preflight', () => {
  const old = manifest()
  const { manifest_hash: _ignored, ...body } = old
  const malformed = sealed({ ...body, units: old.units.map((unit, index) =>
    index === 0 ? { ...unit, passage_hash: 'not-a-sha256' } : unit) })
  assert.throws(() => validateProductionRevisionManifest(malformed), /Invalid|invalid/i)
})
