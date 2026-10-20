// scripts/db/factory-i1/live-fixture-safety.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertLiveFixtureOptIn, assertOwnedFixture, assertOwnedProduct, runCleanupSteps } from './live-fixture-safety.mjs'

test('live fixture is default-off and cannot run in CI', () => {
  assert.throws(() => assertLiveFixtureOptIn([], {}))
  assert.throws(() => assertLiveFixtureOptIn(['--run-owned-fixture'], {}))
  for (const CI of ['1', 'true', 'yes']) assert.throws(() => assertLiveFixtureOptIn(['--run-owned-fixture'], { VF_D3_LIVE_APPROVED: '1', CI }))
  assert.doesNotThrow(() => assertLiveFixtureOptIn(['--run-owned-fixture'], { VF_D3_LIVE_APPROVED: '1' }))
})
test('account cleanup requires exact account, run marker and synthetic flag', () => {
  const own = { id: 'owned', user_metadata: { e2e_run: 'run-a', synthetic: true } }
  assert.doesNotThrow(() => assertOwnedFixture(own, 'owned', 'run-a'))
  for (const other of [null, { ...own, id: 'another' }, { ...own, user_metadata: {} }, { ...own, user_metadata: { e2e_run: 'run-b', synthetic: true } }, { ...own, user_metadata: { e2e_run: 'run-a', synthetic: false } }])
    assert.throws(() => assertOwnedFixture(other, 'owned', 'run-a'))
})
test('product prefix must include the full run, not a global selftest prefix', () => {
  assert.doesNotThrow(() => assertOwnedProduct('D3-LIVE-run-a-A', 'run-a'))
  for (const id of ['D3-LIVE-run-ab-A', 'D3-LIVE-run-b-A', 'real-product', 'D3-LIVE-run-a', null]) assert.throws(() => assertOwnedProduct(id, 'run-a'))
})
test('cleanup failures remain failures and cannot prevent privilege removal and banning', async () => {
  const calls = []
  const errors = await runCleanupSteps([
    ['withdraw', async () => { calls.push('withdraw'); throw new Error('withdraw failed') }],
    ['workspace', async () => { calls.push('workspace'); throw new Error('close failed') }],
    ['remove-role', async () => { calls.push('remove-role') }],
    ['ban', async () => { calls.push('ban') }],
  ])
  assert.deepEqual(calls, ['withdraw', 'workspace', 'remove-role', 'ban'])
  assert.deepEqual(errors.map(e => e.name), ['withdraw', 'workspace'])
})
