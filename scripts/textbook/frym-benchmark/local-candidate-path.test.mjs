// scripts/textbook/frym-benchmark/local-candidate-path.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertExternalCandidate } from './local-candidate-path.mjs'

test('external policy path cannot resolve through a file symlink into the repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frym-policy-path-'))
  try {
    const external = join(dir, 'policy.json')
    writeFileSync(external, '{}')
    assert.doesNotThrow(() => assertExternalCandidate(external))
    const link = join(dir, 'linked-policy.json')
    symlinkSync(fileURLToPath(new URL('./benchmark.mjs', import.meta.url)), link, 'file')
    assert.throws(() => assertExternalCandidate(link), /RAW_CANDIDATES_MUST_STAY_OUTSIDE_REPOSITORY/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
