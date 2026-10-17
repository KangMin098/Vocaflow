// scripts/csat/map/v62/r5-read-only-preload.test.cjs
const { test } = require('node:test')
const assert = require('node:assert/strict')
const forwarded = []
globalThis.fetch = async (input, init) => { forwarded.push([input, init]); return new Response('[]') }
require('./r5-read-only-preload.cjs')

test('only reads, auth token POST, and two audited STABLE RPCs can leave the server', async () => {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    await assert.rejects(fetch('https://example.invalid/rest/v1/learning_task_attempts', { method }), /read-only guard blocked/)
    await assert.rejects(fetch('https://example.invalid/rest/v1/learning_decisions', { method }), /read-only guard blocked/)
  }
  await assert.rejects(fetch('https://example.invalid/rest/v1/rpc/learner_workspace_plan_commit', { method: 'POST' }), /blocked/)
  await assert.rejects(fetch('https://example.invalid/rest/v1/rpc/csat_ec_embargoed_items', { method: 'DELETE' }), /blocked/)
  assert.equal(forwarded.length, 0)
  await fetch('https://example.invalid/rest/v1/csat_items')
  await fetch('https://example.invalid/auth/v1/token', { method: 'POST' })
  await fetch('https://example.invalid/rest/v1/rpc/csat_ec_embargoed_items', { method: 'POST' })
  assert.equal(forwarded.length, 3)
})
