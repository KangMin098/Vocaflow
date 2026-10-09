// scripts/textbook/synthetic-master-production.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runSyntheticMasterProduction, SYNTHETIC_MASTER_ORDERS } from './synthetic-master-production.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'

test('reference orders execute the shared factory and export no signing key or DB client', async () => {
  const outputs = []
  for (const order of SYNTHETIC_MASTER_ORDERS) {
    const result = await runSyntheticMasterProduction(order)
    const { manifest_hash, ...body } = result.manifest
    assert.equal(manifest_hash, hash(body))
    assert.equal(result.manifest.html_sha256, createHash('sha256').update(result.html).digest('hex'))
    assert.match(result.html, /^<!-- synthetic_fixture=true non_production=true;/)
    assert.equal(result.manifest.evidence_level, 'synthetic_mock_rpc')
    assert.equal(result.manifest.production_verified, false)
    assert.equal(result.manifest.publish_eligible, false)
    assert.equal(result.manifest.receipt.published_status, 'published_current')
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE KEY|goldKey|seedKey|"fixture"\s*:/)
    outputs.push(result.manifest.html_sha256)
  }
  assert.equal(new Set(outputs).size, 3)
  await assert.rejects(runSyntheticMasterProduction('arbitrary-real-order'), /ORDER_UNSUPPORTED/)
})

test('CLI writes three marked HTML/manifest artifacts and refuses overwrite before execution', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'vocaflow-master-run-'))
  const output = path.join(parent, 'run')
  const runner = fileURLToPath(new URL('./synthetic-master-run.mjs', import.meta.url))
  try {
    const args = ['--import', 'tsx', runner, '--order', 'all', '--out-dir', output]
    const run = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.doesNotMatch(run.stdout, /TAP version|✔|PRIVATE KEY/)
    const summary = JSON.parse(run.stdout)
    assert.equal(summary.status, 'complete')
    assert.equal(summary.orders.length, 3)
    assert.equal(summary.synthetic_fixture && summary.non_production, true)
    for (const row of summary.orders) {
      const html = fs.readFileSync(path.join(output, `${row.order}.html`), 'utf8')
      const manifest = JSON.parse(fs.readFileSync(path.join(output, `${row.order}.html.manifest.json`), 'utf8'))
      assert.equal(manifest.html_sha256, createHash('sha256').update(html).digest('hex'))
      assert.equal(manifest.manifest_hash, row.manifest_hash)
    }
    const prior = fs.readFileSync(path.join(output, 'run.json'), 'utf8')
    const repeat = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.notEqual(repeat.status, 0)
    assert.match(repeat.stderr, /OUTPUT_DIRECTORY_EXISTS/)
    assert.equal(fs.readFileSync(path.join(output, 'run.json'), 'utf8'), prior)
  } finally {
    if (path.dirname(path.resolve(parent)) !== path.resolve(os.tmpdir()) ||
        !path.basename(parent).startsWith('vocaflow-master-run-')) throw Error('UNSAFE_TEST_CLEANUP')
    fs.rmSync(parent, { recursive: true, force: true })
  }
})
