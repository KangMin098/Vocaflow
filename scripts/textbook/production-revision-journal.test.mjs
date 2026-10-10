// scripts/textbook/production-revision-journal.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { hash } from './frym-benchmark/benchmark.mjs'
import { startRevisionJournal, advanceRevisionJournal, readRevisionJournal,
  recoverRevisionJournal } from './production-revision-journal.mjs'

const h = char => char.repeat(64)
const manifest = (item = h('a')) => {
  const body = { schema: 'textbook-multi-grade-factory-dry-run/1', group_id: 'journal-test',
    group_hash: h('b'), evidence_hash: h('c'), plan_hash: h('d'),
    units: [{ unit_id: 'unit-m1', grade: 'middle_1', product_order_id: 'order-m1',
      order_revision: 1, order_hash: h('e'), source_id: 'source', source_hash: h('f'),
      rights_hash: h('1'), passage_hash: h('2'), unit_content_hash: h('5') }],
    item_evidence: [{ grade: 'middle_1', item_id: 'item-1', item_digest: item, explanation_hash: h('6') }] }
  return { ...body, manifest_hash: hash(body) }
}
const event = (id, type, proof = h('7')) => ({ event_id: id, type, proof_hash: proof,
  group_id: 'journal-test', next_manifest_hash: manifest(h('8')).manifest_hash,
  ...(type === 'publication_simulated' ? { output_hash: proof } : {}) })
const fixture = fn => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'vocaflow-revision-journal-'))
  try { return fn(path.join(parent, 'run'), parent) } finally {
    if (path.dirname(path.resolve(parent)) !== path.resolve(os.tmpdir()) ||
        !path.basename(parent).startsWith('vocaflow-revision-journal-')) throw Error('UNSAFE_TEST_CLEANUP')
    fs.rmSync(parent, { recursive: true, force: true })
  }
}

test('durable review/rebuild/republish resumes and final event retry is idempotent', () => fixture(root => {
  const start = startRevisionJournal(root, manifest(), manifest(h('8')))
  assert.equal(startRevisionJournal(root, manifest(), manifest(h('8'))).record.journal_hash, start.record.journal_hash)
  assert.throws(() => startRevisionJournal(root, manifest(), manifest(h('9'))), /START_CONFLICT/)
  advanceRevisionJournal(root, event('review', 'review_approved'))
  advanceRevisionJournal(root, event('failed', 'rebuild_failed'))
  assert.equal(readRevisionJournal(root).record.workflow.state, 'needs_review')
  advanceRevisionJournal(root, event('review2', 'review_approved'))
  advanceRevisionJournal(root, event('rebuilt', 'rebuild_passed', h('9')))
  const complete = advanceRevisionJournal(root, event('published', 'publication_simulated', h('9')))
  assert.equal(complete.record.workflow.state, 'complete')
  assert.equal(complete.record.workflow.publish_eligible, false)
  assert.equal(advanceRevisionJournal(root, event('published', 'publication_simulated', h('9'))).record.journal_hash,
    complete.record.journal_hash)
  assert.throws(() => advanceRevisionJournal(root, event('published', 'publication_simulated', h('0'))), /REPLAY_CONFLICT/)
  assert.throws(() => advanceRevisionJournal(root, event('extra', 'review_approved')), /TERMINAL/)
}))

test('interrupted writes leave no false success and can resume from the durable head', () => fixture(root => {
  startRevisionJournal(root, manifest(), manifest(h('8')))
  const io = { ...fs, linkSync() { throw Error('ENOSPC') }, unlinkSync() { throw Error('LOCKED') } }
  assert.throws(() => advanceRevisionJournal(root, event('review', 'review_approved'), io), /ENOSPC/)
  const current = recoverRevisionJournal(root)
  assert.equal(current.record.sequence, 0)
  assert.equal(current.record.workflow.state, 'needs_review')
  assert.equal(current.pending_files, 1)
  assert.equal(advanceRevisionJournal(root, event('review', 'review_approved')).record.workflow.state, 'revise')
  assert.equal(fs.existsSync(path.join(root, '.writer-lock')), false)
}))

test('recovery never removes another writer lock; dead locks require reversible manual quarantine', () => fixture(root => {
  startRevisionJournal(root, manifest(), manifest(h('8')))
  const lock = path.join(root, '.writer-lock')
  fs.writeFileSync(lock, JSON.stringify({ token: randomUUID(), pid: 12345, host: os.hostname() }))
  assert.throws(() => advanceRevisionJournal(root, event('review', 'review_approved')), /WRITER_BUSY/)
  assert.throws(() => recoverRevisionJournal(root, () => true), /NOT_RECOVERABLE/)
  assert.equal(fs.existsSync(lock), true)
  const diagnosis = recoverRevisionJournal(root, () => false)
  assert.equal(diagnosis.record.sequence, 0)
  assert.equal(diagnosis.recovery.status, 'manual_quarantine_required')
  assert.equal(fs.existsSync(lock), true)
  assert.equal(recoverRevisionJournal(root, () => false).recovery.lock_token, diagnosis.recovery.lock_token)
  fs.renameSync(lock, path.join(root, `.pending-${randomUUID()}`))
  assert.equal(recoverRevisionJournal(root).recovery.status, 'resume_ready')
}))

test('rehash, gaps and mixed run histories cannot manufacture a completed workflow', () => fixture(root => {
  startRevisionJournal(root, manifest(), manifest(h('8')))
  advanceRevisionJournal(root, event('review', 'review_approved'))
  const file = path.join(root, 'revision-000001.json')
  const original = fs.readFileSync(file, 'utf8')
  const mixed = JSON.parse(original)
  mixed.run_id = randomUUID()
  delete mixed.journal_hash
  fs.writeFileSync(file, JSON.stringify({ ...mixed, journal_hash: hash(mixed) }))
  assert.throws(() => readRevisionJournal(root), /TRANSITION_INVALID/)
  fs.writeFileSync(file, original)
  fs.renameSync(file, path.join(root, 'revision-000002.json'))
  assert.throws(() => readRevisionJournal(root), /GAP/)
}))

test('base impact is recalculated from the preserved manifests, not trusted as a self-hashed claim', () => fixture(root => {
  startRevisionJournal(root, manifest(), manifest(h('8')))
  const file = path.join(root, 'revision-000000.json')
  const record = JSON.parse(fs.readFileSync(file, 'utf8'))
  record.workflow.affected = record.workflow.affected.slice(0, 1)
  delete record.workflow.workflow_hash
  record.workflow.workflow_hash = hash(record.workflow)
  delete record.journal_hash
  record.journal_hash = hash(record)
  fs.writeFileSync(file, JSON.stringify(record))
  assert.throws(() => readRevisionJournal(root), /BASE_INVALID/)
}))

test('process termination before/after atomic lock registration cannot leave a partial lock or false revision', () => fixture((root) => {
  const moduleUrl = new URL('./production-revision-journal.mjs', import.meta.url).href
  for (const afterLink of [false, true]) {
    const run = `${root}-${afterLink}`
    startRevisionJournal(run, manifest(), manifest(h('8')))
    const code = `import fs from 'node:fs'; import { advanceRevisionJournal } from ${JSON.stringify(moduleUrl)};
      const original = fs.linkSync; fs.linkSync = (from,to) => {
        if (to.endsWith('.writer-lock')) { ${afterLink ? 'original(from,to);' : ''} process.exit(42); }
        return original(from,to);
      }; advanceRevisionJournal(${JSON.stringify(run)}, ${JSON.stringify(event('review', 'review_approved'))});`
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { encoding: 'utf8' })
    assert.equal(child.status, 42, child.stderr)
    assert.equal(readRevisionJournal(run).record.sequence, 0)
    const diagnosis = recoverRevisionJournal(run)
    assert.equal(diagnosis.recovery.status, afterLink ? 'manual_quarantine_required' : 'resume_ready')
    const cli = fileURLToPath(new URL('./production-revision-run.mjs', import.meta.url))
    const recovered = spawnSync(process.execPath, ['--import', 'tsx', cli, 'recover', '--run-dir', run], { encoding: 'utf8' })
    assert.equal(recovered.status, 0, recovered.stderr)
    assert.deepEqual(JSON.parse(recovered.stdout).recovery, diagnosis.recovery)
    if (afterLink) fs.renameSync(path.join(run, '.writer-lock'),
      path.join(run, `.pending-${randomUUID()}`))
    assert.equal(advanceRevisionJournal(run, event('review', 'review_approved')).record.sequence, 1)
  }
}))

test('rights withdrawal is terminal and CLI status exposes only a non-production summary', () => fixture((root) => {
  startRevisionJournal(root, manifest(), manifest(), 'rights_revoked')
  assert.throws(() => advanceRevisionJournal(root, event('review', 'review_approved')), /TERMINAL/)
  const cli = fileURLToPath(new URL('./production-revision-run.mjs', import.meta.url))
  const result = spawnSync(process.execPath, ['--import', 'tsx', cli, 'status', '--run-dir', root], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.state, 'withdraw')
  assert.equal(output.synthetic_fixture && output.non_production, true)
  assert.equal(output.publish_eligible, false)
}))

test('a process terminated during initial start can diagnose its lock before any durable record exists', () => fixture(root => {
  const moduleUrl = new URL('./production-revision-journal.mjs', import.meta.url).href
  const code = `import fs from 'node:fs'; import { startRevisionJournal } from ${JSON.stringify(moduleUrl)};
    const original=fs.linkSync; fs.linkSync=(from,to)=> { original(from,to); if(to.endsWith('.writer-lock')) process.exit(42); };
    startRevisionJournal(${JSON.stringify(root)},${JSON.stringify(manifest())},${JSON.stringify(manifest(h('8')))});`
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(child.status, 42, child.stderr)
  const cli = fileURLToPath(new URL('./production-revision-run.mjs', import.meta.url))
  const recovered = spawnSync(process.execPath, ['--import', 'tsx', cli, 'recover', '--run-dir', root], { encoding: 'utf8' })
  assert.equal(recovered.status, 0, recovered.stderr)
  const diagnosis = JSON.parse(recovered.stdout)
  assert.equal(diagnosis.state, 'not_started')
  assert.equal(diagnosis.recovery.status, 'manual_quarantine_required')
  fs.renameSync(path.join(root, '.writer-lock'), path.join(root, `.pending-${randomUUID()}`))
  assert.equal(recoverRevisionJournal(root).record, null)
  assert.equal(startRevisionJournal(root, manifest(), manifest(h('8'))).record.sequence, 0)
}))
