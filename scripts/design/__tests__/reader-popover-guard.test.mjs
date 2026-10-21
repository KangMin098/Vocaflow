// scripts/design/__tests__/reader-popover-guard.test.mjs
// A browser POST guard cannot intercept RSC writes; reject private navigation before any capture work.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

test('private reader capture requires explicit DB-writing intent before creating output or navigating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-reader-guard-'))
  const out = path.join(dir, 'must-not-exist')
  const result = spawnSync(process.execPath, ['scripts/design/reader-popover-check.mjs', '--base', 'http://127.0.0.1:1', '--out', out], { encoding: 'utf8', timeout: 15000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /WORKSPACE_GET_WRITES/)
  assert.doesNotMatch(result.stderr, /ERR_CONNECTION_REFUSED|browserType\.launch/)
  assert.equal(fs.existsSync(out), false)
  fs.rmdirSync(dir)
})
