// scripts/textbook/atomic-volume.mjs
// Multi-day student volume made only of published atomic snapshots (no new DB table).
// Each day/section is one published atomic production snapshot. The volume is valid only
// while every snapshot still serves from the DB with its recorded snapshot/output hash,
// so a source, certificate, order or item change in any day invalidates the whole volume.
// Limitation: order binding of a section is read from the published run manifest; the DB
// serve RPC proves the snapshot and HTML, not the manifest's order list. A DB-side volume
// RPC would close that gap and needs a reviewed migration.
import { createHash } from 'node:crypto'
import { hash } from './frym-benchmark/benchmark.mjs'
import { serveAtomicProductionArtifact } from './atomic-production-snapshot.mjs'

const sha = value => createHash('sha256').update(value, 'utf8').digest('hex')
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const fail = reason => { throw Error(reason) }
export const ATOMIC_VOLUME_MARKER = '<!-- ATOMIC SNAPSHOT VOLUME; NON-PRODUCTION UNTIL OPERATIONAL VERIFICATION -->'

function checkSectionManifest(manifest) {
  const { manifest_hash: recorded, ...base } = manifest ?? {}
  if (!manifest || recorded !== hash(base) || manifest.evidence_level !== 'atomic_snapshot_unpublished' ||
      manifest.production_verified !== false || typeof manifest.snapshot_id !== 'string' ||
      !hex(manifest.snapshot_hash) || !hex(manifest.html_sha256) ||
      manifest.approved_output_hash !== manifest.html_sha256 || !Array.isArray(manifest.units) || !manifest.units.length)
    fail('ATOMIC_VOLUME_SECTION_MANIFEST_INVALID')
}

/**
 * orders: the sealed Product Orders this volume is for ({ grade, product_order_id, order_revision, order_hash }).
 * sections: [{ day, manifest }] where manifest is what runAtomicMultiGradeFactoryDryRun produced and was published.
 */
export async function composeAtomicPlannedVolume(db, { orders, sections } = {}) {
  if (!Array.isArray(orders) || !orders.length || !Array.isArray(sections) || !sections.length)
    fail('ATOMIC_VOLUME_INPUT_INVALID')
  const byOrder = new Map(orders.map(order => [order.product_order_id, order]))
  if (byOrder.size !== orders.length) fail('ATOMIC_VOLUME_ORDER_DUPLICATE')
  const days = new Set(), snapshots = new Set(), unitIds = new Set()
  const ordered = [...sections].sort((a, b) => a.day - b.day)
  const parts = [], records = []
  for (const section of ordered) {
    if (!Number.isInteger(section.day) || section.day < 1 || days.has(section.day)) fail('ATOMIC_VOLUME_DAY_INVALID_OR_DUPLICATE')
    days.add(section.day)
    const manifest = section.manifest
    checkSectionManifest(manifest)
    if (snapshots.has(manifest.snapshot_id)) fail('ATOMIC_VOLUME_SNAPSHOT_REUSED')
    snapshots.add(manifest.snapshot_id)
    const covered = new Set()
    for (const unit of manifest.units) {
      const order = byOrder.get(unit.product_order_id)
      if (!order || unit.grade !== order.grade || unit.order_revision !== order.order_revision ||
          unit.order_hash !== order.order_hash) fail('ATOMIC_VOLUME_ORDER_STALE_OR_MIXED')
      if (unitIds.has(unit.unit_id)) fail('ATOMIC_VOLUME_UNIT_REUSED')
      unitIds.add(unit.unit_id)
      covered.add(unit.product_order_id)
    }
    if (covered.size !== orders.length) fail('ATOMIC_VOLUME_DAY_MISSING_GRADE')
    let served
    try { served = await serveAtomicProductionArtifact(db, manifest.snapshot_id) } catch { fail('ATOMIC_VOLUME_SECTION_NOT_CURRENT') }
    if (served.snapshot_hash !== manifest.snapshot_hash || served.output_hash !== manifest.html_sha256)
      fail('ATOMIC_VOLUME_SECTION_NOT_CURRENT')
    parts.push(`<!-- day ${section.day} snapshot ${manifest.snapshot_id} -->\n${served.html}`)
    records.push({ day: section.day, snapshot_id: manifest.snapshot_id, snapshot_hash: manifest.snapshot_hash,
      output_hash: served.output_hash, section_manifest_hash: manifest.manifest_hash,
      units: manifest.units.map(unit => ({ unit_id: unit.unit_id, grade: unit.grade,
        product_order_id: unit.product_order_id, order_revision: unit.order_revision, order_hash: unit.order_hash })) })
  }
  const maxDay = Math.max(...days)
  if (days.size !== maxDay) fail('ATOMIC_VOLUME_DAY_GAP')
  const html = `${ATOMIC_VOLUME_MARKER}\n${parts.join('\n')}`
  const manifest = { schema: 'textbook-atomic-volume/1', evidence_level: 'atomic_snapshot_volume',
    production_verified: false, publish_eligible: false,
    order_binding: 'section_manifest_checked_db_serves_snapshot_and_html',
    orders: [...orders].sort((a, b) => a.product_order_id.localeCompare(b.product_order_id)),
    sections: records, html_sha256: sha(html) }
  return { html, manifest: { ...manifest, manifest_hash: hash(manifest) } }
}

/** Recomposes from the DB now; any section that no longer serves current evidence fails. */
export async function verifyAtomicPlannedVolume(db, input, output) {
  const current = await composeAtomicPlannedVolume(db, input)
  if (output?.html !== current.html || output?.manifest?.manifest_hash !== current.manifest.manifest_hash ||
      sha(output.html) !== output.manifest.html_sha256) fail('ATOMIC_VOLUME_OUTPUT_STALE_OR_MIXED')
  return current.manifest
}
