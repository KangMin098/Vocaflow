// scripts/textbook/atomic-production-run.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs, { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { writeAtomicDryRunOutput } from './atomic-production-output.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'

const runner = fileURLToPath(new URL('./atomic-production-run.mjs', import.meta.url))

test('existing HTML or manifest blocks dry-run before DB credentials or capture', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vocaflow-atomic-preflight-'))
  const stages = path.join(dir, 'stages.json')
  const render = path.join(dir, 'render.json')
  const output = path.join(dir, 'book.html')
  const manifest = `${output}.manifest.json`
  try {
    writeFileSync(stages, '[]')
    writeFileSync(render, '{}')
    for (const existing of [output, manifest]) {
      writeFileSync(existing, 'existing')
      const result = spawnSync(process.execPath, ['--import', 'tsx', runner, 'dry-run',
        '--group-id', 'fixture', '--stages', stages, '--render', render, '--out', output],
      { encoding: 'utf8', cwd: path.dirname(runner), env: {
        ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
      } })
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /ATOMIC_DRY_RUN_OUTPUT_EXISTS/)
      assert.doesNotMatch(result.stderr, /SUPABASE_SERVICE_CREDENTIALS_MISSING/)
      unlinkSync(existing)
    }
  } finally {
    for (const file of [stages, render]) unlinkSync(file)
    rmdirSync(dir)
  }
})

test('mid-write failures remove only files opened by this run', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vocaflow-atomic-write-'))
  const output = path.join(dir, 'book.html')
  const manifestPath = `${output}.manifest.json`
  try {
    for (const failingWrite of [1, 2]) {
      let writes = 0
      const io = { ...fs, writeFileSync(fd, content, encoding) {
        writes += 1
        fs.writeFileSync(fd, content.slice(0, 3), encoding)
        if (writes === failingWrite) throw Error('ENOSPC')
        fs.writeFileSync(fd, content.slice(3), encoding)
      } }
      const result = writeAtomicDryRunOutput(output, 'sample html', { snapshot_id: 'fixture' }, io)
      assert.deepEqual(result, { ok: false, leftovers: [] })
      assert.equal(fs.existsSync(output), false)
      assert.equal(fs.existsSync(manifestPath), false)
    }
    writeFileSync(manifestPath, 'another run')
    const result = writeAtomicDryRunOutput(output, 'sample html', { snapshot_id: 'fixture' })
    assert.deepEqual(result, { ok: false, leftovers: [] })
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), 'another run')
    assert.equal(fs.existsSync(output), false)
    unlinkSync(manifestPath)
    const cleanupFailure = writeAtomicDryRunOutput(output, 'sample html', { snapshot_id: 'fixture' }, {
      ...fs,
      writeFileSync(fd, content, encoding) {
        fs.writeFileSync(fd, content.slice(0, 3), encoding)
        throw Error('ENOSPC')
      },
      unlinkSync() { throw Error('LOCKED') },
    })
    assert.deepEqual(cleanupFailure, { ok: false, leftovers: [output] })
    assert.equal(fs.existsSync(output), true)
    unlinkSync(output)
  } finally {
    rmdirSync(dir)
  }
})

test('tampered previous manifest fails before DB credentials or capture', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vocaflow-atomic-impact-'))
  const stages = path.join(dir, 'stages.json')
  const render = path.join(dir, 'render.json')
  const prior = path.join(dir, 'prior.json')
  const output = path.join(dir, 'book.html')
  try {
    writeFileSync(stages, '[]')
    writeFileSync(render, '{}')
    for (const [document, expected] of [
      [{ schema: 'textbook-multi-grade-factory-dry-run/1', group_id: 'fixture',
        group_hash: 'a'.repeat(64), units: [], item_evidence: [], manifest_hash: 'tampered' },
      /REVISION_IMPACT_MANIFEST_TAMPERED/],
      [null, /REVISION_IMPACT_MANIFEST_INVALID/],
      [(() => { const body = { schema: 'textbook-multi-grade-factory-dry-run/1',
        group_id: 'another-group', group_hash: 'a'.repeat(64), evidence_hash: 'b'.repeat(64),
        plan_hash: 'c'.repeat(64), units: [{ unit_id: 'unit-1', grade: 'm1',
          product_order_id: 'order-1', order_revision: 1, order_hash: 'd'.repeat(64),
          source_id: 'source-1', source_hash: 'e'.repeat(64), rights_hash: 'f'.repeat(64),
          passage_hash: '1'.repeat(64), unit_content_hash: '2'.repeat(64) }],
        item_evidence: [{ grade: 'm1', item_id: 'item-1', item_digest: '3'.repeat(64),
          explanation_hash: '4'.repeat(64) }] }; return { ...body, manifest_hash: hash(body) } })(),
      /REVISION_IMPACT_GROUP_MIXED/],
    ]) {
      writeFileSync(prior, JSON.stringify(document))
      const result = spawnSync(process.execPath, ['--import', 'tsx', runner, 'dry-run',
        '--group-id', 'fixture', '--stages', stages, '--render', render, '--out', output,
        '--previous-manifest', prior], { encoding: 'utf8', cwd: path.dirname(runner), env: {
          ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
        } })
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, expected)
      assert.doesNotMatch(result.stderr, /SUPABASE_SERVICE_CREDENTIALS_MISSING/)
    }
  } finally {
    for (const file of [stages, render, prior]) unlinkSync(file)
    rmdirSync(dir)
  }
})
