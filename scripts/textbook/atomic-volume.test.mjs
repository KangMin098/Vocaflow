// scripts/textbook/atomic-volume.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { hash } from './frym-benchmark/benchmark.mjs'
import { composeAtomicPlannedVolume, verifyAtomicPlannedVolume } from './atomic-volume.mjs'

const sha = value => createHash('sha256').update(value, 'utf8').digest('hex')
const orders = [
  { grade: 'middle_1', product_order_id: 'order-m1', order_revision: 1, order_hash: 'a'.repeat(64) },
  { grade: 'high_3', product_order_id: 'order-h3', order_revision: 1, order_hash: 'b'.repeat(64) },
]
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// In-memory DB holding published artifacts; `revoke` simulates evidence changing after publication.
function world(dayCount = 3) {
  const artifacts = new Map()
  const sections = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1, snapshot_id = uuid(day), html = `<section>day ${day}</section>`
    const snapshot_hash = sha(`snapshot-${day}`)
    artifacts.set(snapshot_id, { snapshot_id, snapshot_hash, output_hash: sha(html), html })
    const base = { evidence_level: 'atomic_snapshot_unpublished', production_verified: false,
      snapshot_id, snapshot_hash, approved_output_hash: sha(html), html_sha256: sha(html),
      units: orders.map(order => ({ unit_id: `${order.product_order_id}-d${day}`, grade: order.grade,
        product_order_id: order.product_order_id, order_revision: order.order_revision, order_hash: order.order_hash })) }
    return { day, manifest: { ...base, manifest_hash: hash(base) } }
  })
  const revoked = new Set()
  const db = { rpc: async (name, { p_snapshot_id }) => {
    assert.equal(name, 'serve_reading_production_artifact')
    if (revoked.has(p_snapshot_id) || !artifacts.has(p_snapshot_id))
      return { data: null, error: { message: 'published evidence no longer current' } }
    return { data: artifacts.get(p_snapshot_id), error: null }
  } }
  return { db, sections, revoke: id => revoked.add(id) }
}
const remanifest = (section, change) => {
  const { manifest_hash: _drop, ...base } = section.manifest
  const next = change(structuredClone(base))
  return { ...section, manifest: { ...next, manifest_hash: hash(next) } }
}

test('composes a noncontiguous M1/H3 multi-day volume from served snapshots and verifies it', async () => {
  const { db, sections } = world()
  const output = await composeAtomicPlannedVolume(db, { orders, sections })
  assert.equal(output.manifest.sections.length, 3)
  assert.equal(output.manifest.production_verified, false)
  assert.equal(output.manifest.html_sha256, sha(output.html))
  assert.deepEqual(output.manifest.sections.map(s => s.day), [1, 2, 3])
  assert.ok(output.manifest.sections.every(s => s.units.length === 2))
  assert.deepEqual(await verifyAtomicPlannedVolume(db, { orders, sections }, output), output.manifest)
})

test('a later evidence change in any day invalidates the whole volume', async () => {
  const { db, sections, revoke } = world()
  const output = await composeAtomicPlannedVolume(db, { orders, sections })
  revoke(sections[1].manifest.snapshot_id)
  await assert.rejects(verifyAtomicPlannedVolume(db, { orders, sections }, output), /ATOMIC_VOLUME_SECTION_NOT_CURRENT/)
})

test('rejects stale order revision, mixed orders, missing grade, reuse, gaps and tampering', async () => {
  const { db, sections } = world()
  const cases = [
    [{ orders: orders.map(o => o.grade === 'high_3' ? { ...o, order_revision: 2 } : o), sections }, /ORDER_STALE_OR_MIXED/],
    [{ orders, sections: [remanifest(sections[0], m => { m.units[1].product_order_id = 'foreign'; return m }), ...sections.slice(1)] }, /ORDER_STALE_OR_MIXED/],
    [{ orders, sections: [remanifest(sections[0], m => { m.units.pop(); return m }), ...sections.slice(1)] }, /DAY_MISSING_GRADE/],
    [{ orders, sections: [sections[0], { ...sections[0], day: 2 }, sections[2]] }, /SNAPSHOT_REUSED/],
    [{ orders, sections: [sections[0], sections[2]] }, /DAY_GAP/],
    [{ orders, sections: [{ ...sections[0], manifest: { ...sections[0].manifest, snapshot_hash: 'c'.repeat(64) } }] }, /SECTION_MANIFEST_INVALID/],
    [{ orders, sections: [remanifest(sections[0], m => { m.snapshot_hash = 'c'.repeat(64); return m })] }, /SECTION_NOT_CURRENT/],
    [{ orders, sections: [remanifest(sections[0], m => { m.approved_output_hash = 'd'.repeat(64); return m })] }, /SECTION_MANIFEST_INVALID/],
  ]
  for (const [input, error] of cases) await assert.rejects(composeAtomicPlannedVolume(db, input), error)
  const output = await composeAtomicPlannedVolume(db, { orders, sections })
  await assert.rejects(verifyAtomicPlannedVolume(db, { orders, sections }, { ...output, html: output.html + 'x' }), /OUTPUT_STALE_OR_MIXED/)
})

test('accepts the real atomic manifest produced by the P03 M1-M2 synthetic master run', async () => {
  const { exerciseMultiGrade } = await import('./reading-promotion/synthetic-master.mjs')
  const { output } = await exerciseMultiGrade(true)
  const realOrders = output.manifest.units.map(unit => ({ grade: unit.grade, product_order_id: unit.product_order_id,
    order_revision: unit.order_revision, order_hash: unit.order_hash }))
  const db = { rpc: async () => ({ data: { snapshot_id: output.manifest.snapshot_id,
    snapshot_hash: output.manifest.snapshot_hash, output_hash: sha(output.html), html: output.html }, error: null }) }
  const volume = await composeAtomicPlannedVolume(db, { orders: realOrders, sections: [{ day: 1, manifest: output.manifest }] })
  assert.ok(volume.html.includes(output.html))
  assert.equal(volume.manifest.sections[0].snapshot_hash, output.manifest.snapshot_hash)
  assert.deepEqual(volume.manifest.orders.map(o => o.grade).sort(), ['middle_1', 'middle_2'])
})

test('one brief-bound M1-M2 order pair produces a 3-day atomic volume, one snapshot per planned day', async () => {
  const { exerciseMultiGradeDay, syntheticBrief } = await import('./reading-promotion/synthetic-master.mjs')
  const { planProductBrief } = await import('@vocaflow/library-pipeline/product-planning')
  const days = planProductBrief(syntheticBrief(['middle_1', 'middle_2'])).plan.units.length
  assert.equal(days, 3)
  const { generateKeyPairSync } = await import('node:crypto')
  const keys = { goldKey: generateKeyPairSync('ed25519'), seedKey: generateKeyPairSync('ed25519') }
  const runs = []
  for (let day = 1; day <= days; day += 1) runs.push({ day, ...(await exerciseMultiGradeDay(day, keys)) })
  const artifacts = new Map(runs.map(run => [run.output.manifest.snapshot_id, run.output]))
  assert.equal(artifacts.size, days)
  const revoked = new Set()
  const db = { rpc: async (_name, { p_snapshot_id: id }) => revoked.has(id) || !artifacts.has(id)
    ? { data: null, error: { message: 'published evidence no longer current' } }
    : { data: { snapshot_id: id, snapshot_hash: artifacts.get(id).manifest.snapshot_hash,
      output_hash: sha(artifacts.get(id).html), html: artifacts.get(id).html }, error: null } }
  const first = runs[0].output.manifest.units
  const realOrders = first.map(unit => ({ grade: unit.grade, product_order_id: unit.product_order_id,
    order_revision: unit.order_revision, order_hash: unit.order_hash }))
  for (const run of runs) assert.deepEqual(run.receipt.order_hashes, runs[0].receipt.order_hashes)
  const input = { orders: realOrders, sections: runs.map(run => ({ day: run.day, manifest: run.output.manifest })) }
  const volume = await composeAtomicPlannedVolume(db, input)
  assert.equal(volume.manifest.sections.length, 3)
  assert.equal(new Set(volume.manifest.sections.flatMap(s => s.units.map(u => u.unit_id))).size, 6)
  revoked.add(runs[2].output.manifest.snapshot_id)
  await assert.rejects(verifyAtomicPlannedVolume(db, input, volume), /SECTION_NOT_CURRENT/)
})

test('DB volume client sends only days and snapshot IDs and rejects mismatched or unverified responses', async () => {
  const { registerDbAtomicVolume, serveDbAtomicVolume } = await import('./atomic-volume.mjs')
  const { sections } = world()
  const calls = []
  const html = '<!-- ATOMIC SNAPSHOT VOLUME; DB VERIFIED; NON-PRODUCTION UNTIL OPERATIONAL VERIFICATION -->\nbody'
  const db = { rpc: async (name, params) => {
    calls.push([name, params])
    if (name === 'register_reading_production_volume') return { data: { volume_id: params.p_volume_id,
      volume_revision: params.p_volume_revision, volume_hash: 'f'.repeat(64),
      sections: params.p_sections.map(s => ({ ...s, snapshot_hash: 'a'.repeat(64) })) }, error: null }
    return { data: { volume_id: params.p_volume_id, html, output_hash: sha(html) }, error: null }
  } }
  const registered = await registerDbAtomicVolume(db, { volumeId: 'vol-1', revision: 1, orders, sections })
  assert.equal(registered.sections.length, 3)
  assert.deepEqual(Object.keys(calls[0][1].p_sections[0]).sort(), ['day', 'snapshot_id'])
  assert.deepEqual(calls[0][1].p_orders[0], { grade: 'middle_1', order_id: 'order-m1', order_revision: 1, order_hash: 'a'.repeat(64) })
  assert.equal((await serveDbAtomicVolume(db, 'vol-1')).production_verified, false)
  const rejecting = { rpc: async () => ({ data: null, error: { message: 'volume section evidence changed' } }) }
  await assert.rejects(registerDbAtomicVolume(rejecting, { volumeId: 'vol-1', revision: 1, orders, sections }), /DB_VOLUME_REGISTRATION_REJECTED/)
  await assert.rejects(serveDbAtomicVolume(rejecting, 'vol-1'), /DB_VOLUME_SERVE_REJECTED/)
  const tampered = { rpc: async () => ({ data: { volume_id: 'vol-1', html: html + 'x', output_hash: sha(html) }, error: null }) }
  await assert.rejects(serveDbAtomicVolume(tampered, 'vol-1'), /DB_VOLUME_SERVE_REJECTED/)
})
