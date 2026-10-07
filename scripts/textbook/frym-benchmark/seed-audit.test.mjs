// scripts/textbook/frym-benchmark/seed-audit.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hash } from './benchmark.mjs'
import { openSeedAudit, verifySeedAudit } from './seed-audit.mjs'

test('metadata-only seed journal detects interrupted batches and supports a fresh recovery run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frym-seed-audit-'))
  try {
    const path = join(dir, 'first.jsonl')
    const input = { policyHash: hash('policy'), bundleHash: hash('bundle'), candidateCount: 2, startedAt: '2026-10-07T00:00:00Z' }
    const journal = openSeedAudit(path, input)
    journal.append('batch_start', 0, ['reading:source:target-a'])
    journal.append('batch_committed', 0, ['reading:source:target-a'])
    journal.append('batch_start', 1, ['reading:source:target-b'])
    journal.close()
    assert.deepEqual(verifySeedAudit(path).pending_batches, [1])
    assert.equal(verifySeedAudit(path).status, 'interrupted')
    assert.throws(() => openSeedAudit(path, input), /EEXIST/)
    assert.ok(!readFileSync(path, 'utf8').includes('passage_text'))
    const recovery = openSeedAudit(join(dir, 'recovery.jsonl'), input)
    recovery.append('batch_start', 0, ['reading:source:target-b'])
    recovery.append('batch_committed', 0, ['reading:source:target-b'])
    recovery.append('run_complete')
    recovery.close()
    assert.equal(verifySeedAudit(join(dir, 'recovery.jsonl')).status, 'complete')
    const tampered = readFileSync(path, 'utf8').replace('target-b', 'target-x')
    writeFileSync(join(dir, 'tampered.jsonl'), tampered)
    assert.equal(verifySeedAudit(join(dir, 'tampered.jsonl')).status, 'invalid')
    writeFileSync(join(dir, 'truncated.jsonl'), `${readFileSync(path, 'utf8')}{"incomplete":`)
    const truncated = verifySeedAudit(join(dir, 'truncated.jsonl'))
    assert.equal(truncated.status, 'invalid_tail')
    assert.deepEqual(truncated.pending_batches, [1])
    assert.equal(truncated.run_id, journal.runId)
    const mismatched = openSeedAudit(join(dir, 'mismatched.jsonl'), input)
    mismatched.append('batch_start', 0, ['reading:source:target-a'])
    mismatched.append('batch_committed', 0, ['reading:source:target-b'])
    mismatched.close()
    assert.equal(verifySeedAudit(join(dir, 'mismatched.jsonl')).status, 'invalid')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
