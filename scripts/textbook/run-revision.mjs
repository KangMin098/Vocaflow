// scripts/textbook/run-revision.mjs
// Revision impact for an order-production run and its atomic multi-day volume.
// 1) inspectRunRevision compares two assembled runs cell by cell and names the days to rebuild.
// 2) reviseRunAtomicVolume rebuilds only those days as new group revisions, reuses the other
//    days' published snapshots, recomposes the volume and reports per-day artifact impact.
// The prior volume is never edited; it simply stops verifying once a rebuilt day replaces it.
import { inspectProductionRevisionImpact } from './production-revision-impact.mjs'
import { composeRunDayResults, produceRunDayAtomic } from './run-atomic-bridge.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { hash } from './frym-benchmark/benchmark.mjs'
import { advanceRevisionJournal, readRevisionJournal, startRevisionJournal } from './production-revision-journal.mjs'

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

/**
 * Same as reviseRunAtomicVolume, but every rebuilt day is recorded in its own hash-chained
 * revision journal under `journalRoot/day-<N>-r<revision>` (outside the repository):
 * start -> review_approved -> rebuild_passed -> publication_simulated -> complete.
 * Rebuilds are deterministic, so a rerun after an interruption re-derives the same manifests
 * and the journal start/advance calls are idempotent; nothing is recorded as complete twice.
 * The volume is returned only when every rebuilt day's journal reached `complete`.
 */
export async function reviseRunAtomicVolumeJournaled({ priorRun, nextRun, prior, trust, journalRoot, onStep = () => {} }) {
  const revised = await reviseRunAtomicVolume({ priorRun, nextRun, prior, trust })
  if (!revised.day_impacts.length) return { ...revised, journals: [] }
  const journals = []
  for (const { day, revision, impact } of revised.day_impacts) {
    const before = prior.days.find(result => result.day === day).output.manifest
    const after = revised.produced.days.find(result => result.day === day).output.manifest
    const dir = path.join(journalRoot, `day-${day}-r${revision}`)
    if (!fs.existsSync(journalRoot)) fs.mkdirSync(journalRoot)
    startRevisionJournal(dir, before, after, 'changed')
    onStep({ day, step: 'started' })
    const base = { group_id: after.group_id, next_manifest_hash: after.manifest_hash }
    advanceRevisionJournal(dir, { ...base, event_id: `d${day}-r${revision}-review`, type: 'review_approved',
      proof_hash: hash(impact) })
    onStep({ day, step: 'reviewed' })
    advanceRevisionJournal(dir, { ...base, event_id: `d${day}-r${revision}-rebuild`, type: 'rebuild_passed',
      proof_hash: after.html_sha256 })
    onStep({ day, step: 'rebuilt' })
    const done = advanceRevisionJournal(dir, { ...base, event_id: `d${day}-r${revision}-publish`,
      type: 'publication_simulated', proof_hash: after.html_sha256, output_hash: after.html_sha256 })
    if (done.record.workflow.state !== 'complete') throw Error('RUN_REVISION_JOURNAL_INCOMPLETE')
    journals.push({ day, revision, dir, state: done.record.workflow.state, sequence: done.record.sequence })
  }
  return { ...revised, journals }
}

/** Read-only: state of every day journal under one root; any incomplete or broken day blocks the volume. */
export function runRevisionJournalStatus(journalRoot) {
  const days = fs.readdirSync(journalRoot).filter(name => /^day-\d+-r\d+$/.test(name)).sort()
  const rows = days.map(name => {
    try {
      const { record, pending_files } = readRevisionJournal(path.join(journalRoot, name))
      return { journal: name, state: record.workflow.state, sequence: record.sequence, pending_files }
    } catch (error) { return { journal: name, state: 'unreadable', reason: error.message } }
  })
  return { journals: rows, volume_ready: rows.length > 0 && rows.every(row => row.state === 'complete') }
}
