// scripts/textbook/__tests__/source-policy-import.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importSourcePolicyBatch } from '../source-policy-import.mjs'

const now = Date.parse('2026-09-19T10:00:00Z')
const revision = '2026-09-19T08:00:00.123456+00:00'
function projection(id = 'a') {
  return { article_id: id, source_updated_at: revision, measured_at: '2026-09-19T09:00:00Z',
    policy_version: 3, input: { syntaxScore: 70 }, result: { grade: 'usable', blockers: [] },
    quality_flags: [], excerpt_evidence: {}, linked_items: 0 }
}
function fixture(rows, previous = []) {
  const sources = new Map(rows.map(row => [row.article_id, { id: row.article_id, updated_at: row.source_updated_at }]))
  const cache = new Map(previous.map(row => [row.article_id, structuredClone(row)]))
  const writes = []; const backups = []; const reads = []
  const options = { rows, now,
    readSources: async ids => { reads.push(ids.length); return ids.flatMap(id => sources.has(id) ? [sources.get(id)] : []) },
    readPrevious: async ids => ids.flatMap(id => cache.has(id) ? [cache.get(id)] : []),
    backup: async value => { backups.push(structuredClone(value)) },
    write: async changed => {
      writes.push(structuredClone(changed))
      for (const row of changed) cache.set(row.article_id, structuredClone(row))
      return structuredClone(changed)
    },
  }
  return { options, sources, cache, writes, backups, reads }
}

test('source changed by one microsecond: refuse entire mixed 500-row batch before writing', async () => {
  const rows = Array.from({ length: 500 }, (_, i) => projection(String(i)))
  const f = fixture(rows, rows.slice(0, 250))
  f.sources.get('499').updated_at = '2026-09-19T08:00:00.123457+00:00'
  await assert.rejects(importSourcePolicyBatch(f.options), /Source revision changed/)
  assert.deepEqual(f.reads, [100, 100, 100, 100, 100])
  assert.equal(f.writes.length, 0)
  assert.equal(f.backups.length, 0)
})

test('newer same-revision cache prevents an older projection from restoring old flags', async () => {
  const row = projection()
  const f = fixture([row], [{ ...row, measured_at: '2026-09-19T09:00:00.000001Z', quality_flags: ['html-attr'] }])
  await assert.rejects(importSourcePolicyBatch(f.options), /Newer cache measurement/)
  assert.equal(f.writes.length, 0)
  assert.deepEqual(f.cache.get('a').quality_flags, ['html-attr'])
})

test('unsorted mixed 500-row import and retry preserve exact backups and are idempotent', async () => {
  const rows = Array.from({ length: 500 }, (_, i) => projection(String(499 - i)))
  const previous = rows.slice(0, 250).map((row, i) => i === 249 ? { ...row, quality_flags: ['html-attr'] } : row)
  const f = fixture(rows, previous)
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 251)
  assert.equal(f.writes.length, 1)
  assert.equal(f.backups[0].previous.length, 250)
  assert.equal(f.backups[0].insertedIds.length, 250)
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 0)
  assert.equal(f.writes.length, 1)
})

test('a newer measurement advances the watermark even when the verdict is identical', async () => {
  const row = projection()
  const f = fixture([row], [{ ...row, measured_at: '2026-09-19T08:59:59Z' }])
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 1)
  assert.equal(f.cache.get('a').measured_at, row.measured_at)
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 0)
})

test('fresh projection replaces a stale cache from another source revision', async () => {
  const row = projection()
  const f = fixture([row], [{ ...row, source_updated_at: '2026-09-18T08:00:00Z', measured_at: '2026-09-19T09:30:00Z' }])
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 1)
})

test('same instant with a different timezone or precision is an idempotent retry', async () => {
  const row = projection()
  const f = fixture([row], [{ ...row, measured_at: '2026-09-19T18:00:00.000000+09:00' }])
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 0)
})

for (const measured_at of ['invalid', '2026-09-18T09:59:59Z', '2026-09-19T11:00:00Z']) {
  test(`reject unsafe measurement ${measured_at}`, async () => {
    const f = fixture([{ ...projection(), measured_at }])
    await assert.rejects(importSourcePolicyBatch(f.options), /Invalid|older than 24 hours|future/)
    assert.equal(f.writes.length, 0)
  })
}

test('missing source and duplicate projections fail closed', async () => {
  const missing = fixture([projection()])
  missing.sources.clear()
  await assert.rejects(importSourcePolicyBatch(missing.options), /missing/)
  const duplicate = fixture([projection(), projection()])
  await assert.rejects(importSourcePolicyBatch(duplicate.options), /Duplicate/)
  assert.equal(missing.writes.length + duplicate.writes.length, 0)
})

test('uncertain response can be retried without a second database write', async () => {
  const f = fixture([projection()])
  const write = f.options.write
  f.options.write = async rows => { await write(rows); throw new Error('response lost') }
  await assert.rejects(importSourcePolicyBatch(f.options), /response lost/)
  f.options.write = write
  assert.equal((await importSourcePolicyBatch(f.options)).changed, 0)
  assert.equal(f.writes.length, 1)
})

test('verification catches silently corrupted flags even when the verdict matches', async () => {
  const f = fixture([projection()])
  f.options.write = async rows => rows.map(row => ({ ...row, quality_flags: ['html-attr'] }))
  await assert.rejects(importSourcePolicyBatch(f.options), /Batch verification failed/)
})
