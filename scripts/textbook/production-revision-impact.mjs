// scripts/textbook/production-revision-impact.mjs
import { planFactoryImpact } from '@vocaflow/library-pipeline/factory-order'
import { hash } from './frym-benchmark/benchmark.mjs'

function checked(manifest) {
  if (!manifest || manifest.schema !== 'textbook-multi-grade-factory-dry-run/1' ||
      !Array.isArray(manifest.units) || !Array.isArray(manifest.item_evidence) ||
      typeof manifest.group_id !== 'string' || typeof manifest.group_hash !== 'string')
    throw Error('REVISION_IMPACT_MANIFEST_INVALID')
  const { manifest_hash: storedHash, ...body } = manifest
  if (storedHash !== hash(body)) throw Error('REVISION_IMPACT_MANIFEST_TAMPERED')
  const units = new Map()
  for (const unit of manifest.units) {
    if (!unit || typeof unit.grade !== 'string' || units.has(unit.grade) ||
        !unit.source_id || !unit.product_order_id || !unit.order_revision)
      throw Error('REVISION_IMPACT_UNIT_INVALID')
    units.set(unit.grade, unit)
  }
  if (!units.size || new Set(manifest.units.map(unit => unit.source_id)).size !== 1)
    throw Error('REVISION_IMPACT_SOURCE_MIXED')
  if (new Set(manifest.units.map(unit => unit.source_hash)).size !== 1 ||
      new Set(manifest.units.map(unit => unit.rights_hash)).size !== 1)
    throw Error('REVISION_IMPACT_SOURCE_MIXED')
  const items = new Map()
  for (const item of manifest.item_evidence) {
    if (!unitForItem(units, item) || !item.item_id || items.has(item.item_id))
      throw Error('REVISION_IMPACT_ITEM_INVALID')
    items.set(item.item_id, item)
  }
  if (!items.size || [...units.keys()].some(grade => ![...items.values()].some(item => item.grade === grade)))
    throw Error('REVISION_IMPACT_ITEM_MISSING')
  return { manifest, units, items }
}

export function validateProductionRevisionManifest(manifest) {
  const prior = checked(manifest)
  planFactoryImpact(graph(prior), [], 'changed')
  return true
}

function unitForItem(units, item) { return item && units.get(item.grade) }

function graph(prior) {
  const units = [...prior.units.values()]
  const sourceId = `source:${units[0].source_id}`
  const rows = [{ artifact_id: sourceId, kind: 'source', product_order_id: null,
    order_revision: null, evidence_hash: units[0].source_hash, depends_on: [] }]
  for (const unit of units) {
    const order = { product_order_id: unit.product_order_id, order_revision: unit.order_revision }
    const passageId = `passage:${unit.grade}`
    rows.push({ artifact_id: passageId, kind: 'passage', ...order,
      evidence_hash: unit.passage_hash, depends_on: [sourceId] })
    const explanationIds = []
    for (const item of prior.items.values()) {
      if (item.grade !== unit.grade) continue
      const itemId = `item:${item.item_id}`
      const explanationId = `explanation:${item.item_id}`
      rows.push({ artifact_id: itemId, kind: 'item', ...order,
        evidence_hash: item.item_digest, depends_on: [passageId] })
      rows.push({ artifact_id: explanationId, kind: 'explanation', ...order,
        evidence_hash: item.explanation_hash, depends_on: [itemId] })
      explanationIds.push(explanationId)
    }
    rows.push({ artifact_id: `unit:${unit.grade}`, kind: 'unit', ...order,
      evidence_hash: unit.unit_content_hash, depends_on: explanationIds })
  }
  return rows
}

export function inspectProductionRevisionImpact(priorManifest, nextManifest, cause = 'changed') {
  if (!['changed', 'rights_revoked'].includes(cause)) throw Error('REVISION_IMPACT_CAUSE_INVALID')
  const prior = checked(priorManifest)
  const next = checked(nextManifest)
  if (prior.manifest.group_id !== next.manifest.group_id)
    throw Error('REVISION_IMPACT_GROUP_MIXED')
  const oldUnits = [...prior.units.values()]
  const newUnits = [...next.units.values()]
  const changed = new Set()
  if (cause === 'rights_revoked') changed.add(`source:${oldUnits[0].source_id}`)
  if (prior.manifest.group_hash !== next.manifest.group_hash)
    for (const unit of oldUnits) changed.add(`passage:${unit.grade}`)
  if (oldUnits[0].source_id !== newUnits[0].source_id ||
      oldUnits[0].source_hash !== newUnits[0].source_hash ||
      oldUnits.some(unit => unit.rights_hash !== next.units.get(unit.grade)?.rights_hash))
    changed.add(`source:${oldUnits[0].source_id}`)
  for (const unit of oldUnits) {
    const newer = next.units.get(unit.grade)
    if (!newer || unit.product_order_id !== newer.product_order_id ||
        unit.order_revision !== newer.order_revision || unit.order_hash !== newer.order_hash ||
        unit.passage_hash !== newer.passage_hash || unit.adaptation_hash !== newer.adaptation_hash ||
        unit.benchmark_snapshot_hash !== newer.benchmark_snapshot_hash)
      changed.add(`passage:${unit.grade}`)
    if (unit.unit_content_hash !== newer?.unit_content_hash || unit.unit_set_hash !== newer?.unit_set_hash ||
        unit.item_set_hash !== newer?.item_set_hash)
      changed.add(`unit:${unit.grade}`)
  }
  for (const item of prior.items.values()) {
    const newer = next.items.get(item.item_id)
    if (!newer || newer.grade !== item.grade || newer.item_digest !== item.item_digest)
      changed.add(`item:${item.item_id}`)
    if (!newer || newer.explanation_hash !== item.explanation_hash)
      changed.add(`explanation:${item.item_id}`)
  }
  const affected = planFactoryImpact(graph(prior), [...changed], cause)
  const volumeChanged = affected.length > 0 || prior.manifest.group_hash !== next.manifest.group_hash ||
    prior.manifest.evidence_hash !== next.manifest.evidence_hash ||
    prior.manifest.plan_hash !== next.manifest.plan_hash || prior.units.size !== next.units.size ||
    prior.items.size !== next.items.size
  return { schema: 'textbook-production-revision-impact/1', group_id: prior.manifest.group_id,
    prior_manifest_hash: prior.manifest.manifest_hash, next_manifest_hash: next.manifest.manifest_hash,
    cause, affected: volumeChanged ? [...affected,
      { artifact_id: `volume:${prior.manifest.group_id}`, proposed_state: cause === 'rights_revoked' ? 'invalidated' : 'stale', authorized: false },
      { artifact_id: `render:${prior.manifest.group_id}`, proposed_state: cause === 'rights_revoked' ? 'invalidated' : 'stale', authorized: false },
      { artifact_id: `publication:${prior.manifest.group_id}`, proposed_state: cause === 'rights_revoked' ? 'invalidated' : 'stale', authorized: false }] : affected,
    authorized: false }
}
