// scripts/textbook/atomic-production-run.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs, { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { writeAtomicDryRunOutput } from './atomic-production-output.mjs'

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
