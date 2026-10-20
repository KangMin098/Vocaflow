// scripts/db/factory-i1/live-fixture-safety.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { assertLiveFixtureOptIn, assertOwnedFixture, assertOwnedProduct, liveFixtureEmail, sendOwnedRegistration, reconcileOwnedRegistration, runCleanupSteps } from './live-fixture-safety.mjs'

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

test('fixture email matches both canonical demand statistics and application synthetic domains', () => {
  const email = liveFixtureEmail('f0db1c87-800d-41ad-aa10-4ef651b60cf4')
  const stats = fs.readFileSync(new URL('../../docs/gen-db-stats.mjs', import.meta.url), 'utf8')
  const classifier = stats.match(/data\.users\.filter\(\(u\) => (\/.*?\/[a-z]*)\.test\(u\.email/)
  assert.ok(classifier, 'Must find the actual stats classifier, not a copied expectation')
  const [, pattern, flags] = classifier[1].match(/^\/(.*)\/([a-z]*)$/)
  assert.ok(new RegExp(pattern, flags).test(email))
  const app = fs.readFileSync(new URL('../../../apps/web/src/lib/knowledge/practice.ts', import.meta.url), 'utf8')
  const domains = app.match(/SYNTHETIC_EMAIL_DOMAINS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1))
  assert.ok(domains.includes(email.split('@')[1]))
  assert.throws(() => liveFixtureEmail('unbounded-run'))
})

const command = revision => ({ action: 'register', order: { product_order_id: 'D3-LIVE-run-a-A', order_revision: revision }, order_hash: 'a'.repeat(64), request_key: `request-${revision}`, spec: { fixture: true }, quantity: 4, reason: 'owned test' })
function fixture() {
  const registrations = new Map(), rows = new Map(), withdrawn = [], persisted = []
  const key = cmd => `${cmd.order.product_order_id}:${cmd.order.order_revision}`
  const commit = async cmd => {
    if (!rows.has(key(cmd))) rows.set(key(cmd), { product_order_id: cmd.order.product_order_id, order_revision: cmd.order.order_revision, order_hash: cmd.order_hash, request_key: cmd.request_key, registered_by: 'owned', is_current: true })
    return { recorded_id: cmd.order.product_order_id }
  }
  const persist = () => { persisted.push(JSON.parse(JSON.stringify([...registrations.values()]))) }
  const cleanup = entry => reconcileOwnedRegistration({ entry, run: 'run-a', actor: 'owned', settle: commit,
    lookup: async e => rows.get(`${e.product_order_id}:${e.order_revision}`),
    withdraw: async e => { withdrawn.push(e.order_revision); rows.get(`${e.product_order_id}:${e.order_revision}`).is_current = false },
  })
  return { registrations, rows, withdrawn, persisted, persist, commit, cleanup }
}
test('committed registration with a lost response remains durable and is withdrawn', async () => {
  const f = fixture()
  await assert.rejects(sendOwnedRegistration({ command: command(1), run: 'run-a', registrations: f.registrations, persist: f.persist,
    send: async cmd => { assert.equal(f.persisted.length, 1); await f.commit(cmd); throw Error('response lost') },
  }), /response lost/)
  const [entry] = f.persisted[0]
  assert.deepEqual(entry.command, command(1))
  assert.equal(await f.cleanup(entry), 'withdrawn')
  assert.equal(f.rows.size, 1, 'Full-body replay must not duplicate the committed registration')
  assert.deepEqual(f.withdrawn, [1])
})
test('unreceived or late registration is settled using the identical request before withdrawal', async () => {
  const f = fixture()
  await assert.rejects(sendOwnedRegistration({ command: command(1), run: 'run-a', registrations: f.registrations, persist: f.persist, send: async () => { throw Error('not delivered') } }))
  const entry = f.persisted[0][0]
  assert.equal(await f.cleanup(entry), 'withdrawn')
  await f.commit(command(1)) // original request arrives after cleanup: UUID replay keeps it inactive
  assert.equal(f.rows.size, 1)
  assert.equal(f.rows.get('D3-LIVE-run-a-A:1').is_current, false)
})
test('revision response loss retains both exact identities instead of losing the latest revision', async () => {
  const f = fixture()
  await sendOwnedRegistration({ command: command(1), run: 'run-a', registrations: f.registrations, persist: f.persist, send: f.commit })
  await assert.rejects(sendOwnedRegistration({ command: command(2), run: 'run-a', registrations: f.registrations, persist: f.persist, send: async cmd => { await f.commit(cmd); throw Error('lost') } }))
  assert.deepEqual(f.persisted.at(-1).map(e => e.order_revision), [1, 2])
  for (const entry of f.persisted.at(-1)) await f.cleanup(entry)
  assert.deepEqual(f.withdrawn, [1, 2])
})
test('failed journal persistence prevents sending a registration', async () => {
  let sent = false
  await assert.rejects(sendOwnedRegistration({ command: command(1), run: 'run-a', registrations: new Map(), persist: () => { throw Error('disk failure') }, send: async () => { sent = true } }), /disk failure/)
  assert.equal(sent, false)
})
test('reconciliation refuses a different hash, actor or UUID and propagates lookup/settlement failure', async () => {
  const entry = { product_order_id: 'D3-LIVE-run-a-A', order_revision: 1, order_hash: 'a'.repeat(64), request_key: 'request-1', command: command(1) }
  for (const patch of [{ order_hash: 'b'.repeat(64) }, { registered_by: 'other' }, { request_key: 'other' }, { is_current: null }]) {
    let wrote = false
    await assert.rejects(reconcileOwnedRegistration({ entry, run: 'run-a', actor: 'owned', settle: async () => {}, lookup: async () => ({ ...entry, registered_by: 'owned', is_current: true, ...patch }), withdraw: async () => { wrote = true } }))
    assert.equal(wrote, false)
  }
  for (const stage of ['settle', 'lookup']) {
    await assert.rejects(reconcileOwnedRegistration({ entry, run: 'run-a', actor: 'owned', settle: async () => { if (stage === 'settle') throw Error(stage) }, lookup: async () => { throw Error(stage) }, withdraw: async () => assert.fail() }), new RegExp(stage))
  }
})
test('a journal command mismatch is rejected before replay can change any row', async () => {
  let settled = false
  const cmd = command(1)
  const entry = { product_order_id: cmd.order.product_order_id, order_revision: 2, order_hash: cmd.order_hash, request_key: cmd.request_key, command: cmd }
  await assert.rejects(reconcileOwnedRegistration({ entry, run: 'run-a', actor: 'owned', settle: async () => { settled = true }, lookup: async () => assert.fail(), withdraw: async () => assert.fail() }), /Journal command mismatch/)
  assert.equal(settled, false)
})
