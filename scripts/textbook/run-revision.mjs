// scripts/textbook/run-revision.mjs
// Revision impact for an order-production run and its atomic multi-day volume.
// 1) inspectRunRevision compares two assembled runs cell by cell and names the days to rebuild.
// 2) reviseRunAtomicVolume rebuilds only those days as new group revisions, reuses the other
//    days' published snapshots, recomposes the volume and reports per-day artifact impact.
// The prior volume is never edited; it simply stops verifying once a rebuilt day replaces it.
import { inspectProductionRevisionImpact } from './production-revision-impact.mjs'
import { composeRunDayResults, produceRunDayAtomic } from './run-atomic-bridge.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'

const key = unit => `${unit.grade}:${unit.day}`

function unitFingerprint(run, unit) {
  const order = run.volumeInput.orders.find(entry => entry.grade === unit.grade)
  const lineage = run.lineage.find(row => row.grade === unit.grade && row.day === unit.day)
  const gated = run.gatedItems.find(row => row.unit_id === unit.unit_id)?.items ?? []
  return { order_hash: order?.order_hash, order_revision: order?.order.order_revision,
    passage_hash: lineage?.passage_hash, unit_hash: lineage?.unit_hash,
    resource_sha256: lineage?.resource_sha256 ?? null, items: hash(gated) }
}

/** Day-level impact between two assembled runs of the same brief and grades. */
export function inspectRunRevision(prior, next) {
  if (prior?.status !== 'assembled' || next?.status !== 'assembled') throw Error('RUN_REVISION_INPUT_NOT_ASSEMBLED')
  const grades = run => run.volumeInput.orders.map(entry => entry.grade).join(',')
  if (grades(prior) !== grades(next) ||
      prior.volumeInput.orders.some((entry, i) => entry.order.product_order_id !== next.volumeInput.orders[i].order.product_order_id))
    throw Error('RUN_REVISION_ORDER_SET_CHANGED')
  const nextUnits = new Map(next.volumeInput.units.map(unit => [key(unit), unit]))
  if (nextUnits.size !== prior.volumeInput.units.length) throw Error('RUN_REVISION_PLAN_CHANGED')
  const reasons = new Map()
  for (const unit of prior.volumeInput.units) {
    const newer = nextUnits.get(key(unit))
    if (!newer) throw Error('RUN_REVISION_PLAN_CHANGED')
    const before = unitFingerprint(prior, unit), after = unitFingerprint(next, newer)
    const changed = Object.keys(before).filter(field => before[field] !== after[field])
    if (changed.length) reasons.set(unit.day, [...(reasons.get(unit.day) ?? []),
      ...changed.map(field => `${unit.grade}:${field}`)])
  }
  const days = [...new Set(prior.volumeInput.units.map(unit => unit.day))].sort((a, b) => a - b)
  return { schema: 'textbook-run-revision-impact/1',
    rebuild_days: days.filter(day => reasons.has(day)), reuse_days: days.filter(day => !reasons.has(day)),
    reasons: Object.fromEntries([...reasons].map(([day, why]) => [day, why])),
    volume_state: reasons.size ? 'stale' : 'current' }
}

/** Rebuilds changed days only; `prior` is the result of produceRunAtomicVolume / a previous revise. */
export async function reviseRunAtomicVolume({ priorRun, nextRun, prior, trust }) {
  const impact = inspectRunRevision(priorRun, nextRun)
  if (!impact.rebuild_days.length) return { impact, produced: prior, day_impacts: [] }
  const byDay = new Map(prior.days.map(result => [result.day, result]))
  const results = [], dayImpacts = []
  for (const day of [...impact.reuse_days, ...impact.rebuild_days].sort((a, b) => a - b)) {
    const before = byDay.get(day)
    if (!before) throw Error('RUN_REVISION_PRIOR_DAY_MISSING')
    if (impact.reuse_days.includes(day)) { results.push(before); continue }
    const revision = before.revision + 1
    const rebuilt = { ...(await produceRunDayAtomic({ run: nextRun, day, trust, revision })), revision }
    dayImpacts.push({ day, revision, impact: inspectProductionRevisionImpact(
      before.output.manifest, rebuilt.output.manifest, 'changed') })
    results.push(rebuilt)
  }
  const produced = await composeRunDayResults(nextRun, results)
  return { impact, produced, day_impacts: dayImpacts }
}
