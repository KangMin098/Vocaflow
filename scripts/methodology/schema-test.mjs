// scripts/methodology/schema-test.mjs
// Isolated local PostgreSQL test. PGlite is installed outside the application, never a runtime dependency.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const [pgliteDirectory, bundlePath] = process.argv.slice(2)
if (!pgliteDirectory || !bundlePath) throw new Error('Usage: node scripts/methodology/schema-test.mjs <external-pglite-install> <derived-bundle.json>')
const { PGlite } = await import(pathToFileURL(resolve(pgliteDirectory, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const bundle = JSON.parse(await readFile(resolve(bundlePath), 'utf8'))
const sql = await readFile(new URL('../../docs/methodology/schema.sql', import.meta.url), 'utf8')
let parent = null
const call = b => db.query('select public.methodology_import($1::jsonb,$2,$3) as result', [JSON.stringify(b), 'local-test', parent])
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await db.exec(sql)
  await db.exec('set role service_role')
  await assert.rejects(call({ ...bundle, schemaVersion: null }), /Invalid methodology bundle/)
  const first = (await call(bundle)).rows[0].result
  assert.equal(first.status, 'imported')
  assert.equal((await call(bundle)).rows[0].result.status, 'already_imported')
  parent = first.id
  const read = (await db.query('select public.methodology_read($1) as result', [first.id])).rows[0].result
  for (const key of ['experts','sources','methods','claims','evidence','taxonomy','channels','relations','gaps']) {
    const sort = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id))
    assert.deepEqual(sort(read.bundle[key]), sort(bundle[key]), `round trip ${key}`)
  }
  const bad = structuredClone(bundle); bad.evidence[0].sourceRevision = 'stale'
  await assert.rejects(call(bad), /foreign key/)
  const orphan = structuredClone(bundle); orphan.evidence = orphan.evidence.slice(1)
  await assert.rejects(call(orphan), /Claim without supporting/)
  const smuggled = structuredClone(bundle); smuggled.sources[0].transcript = 'do not store'
  await assert.rejects(call(smuggled), /Unknown fields/)
  const missingLocation = structuredClone(bundle); missingLocation.evidence[0].locator = { kind: 'section' }
  await assert.rejects(call(missingLocation), /check constraint/)
  const cyclic = structuredClone(bundle); cyclic.taxonomy[0].parentId = cyclic.taxonomy[0].id
  await assert.rejects(call(cyclic), /Taxonomy cycle/)
  assert.equal((await db.query('select count(*)::int as n from public.methodology_batches')).rows[0].n, 1, 'failed batches roll back completely')
  const next = structuredClone(bundle); next.gaps[0].nextAction += ' Verified in local fixture.'
  parent = null
  await assert.rejects(call(next), /Snapshot head changed/)
  parent = first.id
  assert.equal((await call(next)).rows[0].result.status, 'imported')
  await db.exec('reset role; set role authenticated')
  await assert.rejects(db.query('select * from public.methodology_methods'), /permission denied/)
  await assert.rejects(call(bundle), /permission denied/)
  await db.exec('reset role; set role anon')
  await assert.rejects(db.query('select public.methodology_read()'), /permission denied/)
  console.log('PASS: DDL, service-role import, idempotent replay, exact round trip, FK, evidence, raw-payload rejection, required locator, taxonomy cycle, atomic rollback, stale-head rejection, authenticated/anon denial')
} finally { await db.close() }
