// scripts/db/factory-i1/deploy.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { targetOf, writeAuthorizationBlocks, redactText, offlineCheck, evaluatePreflight } from './deploy.mjs'
import { PROJECT_REF } from './spec.mjs'
import fs from 'node:fs'
const url = `postgresql://postgres:example-password@db.${PROJECT_REF}.supabase.co:5432/postgres`

test('production target rejects pg query overrides, protocol, database, pooler mode and alternate ports', () => {
  assert.equal(targetOf(url).ok, true)
  for (const bad of [url + '?host=another-project', url + '?sslmode=disable', url + '#fragment', url.replace('postgresql:', 'https:'),
    url.replace(/\/postgres$/, '/other'), url.replace(':5432/', ':6543/'), url.replace(':5432/', '/'), url.replace(PROJECT_REF, 'otherproject'),
    `postgresql://postgres.${PROJECT_REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`]) assert.equal(targetOf(bad).ok, false)
  assert.equal(targetOf(`postgresql://postgres.${PROJECT_REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`).ok, true)
})

test('approval metadata and a TTY never override auto/CI or isolated CLI write blocks', () => {
  const terminal = { env: {}, stdinIsTTY: true, stdoutIsTTY: true }
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.ok(writeAuthorizationBlocks({ approvedBy: 'user says yes' }, { ...terminal, env }).length)
  }
  assert.ok(writeAuthorizationBlocks({ isolated: true }, terminal).length)
  assert.ok(writeAuthorizationBlocks({}, { ...terminal, stdinIsTTY: false }).length)
  assert.ok(writeAuthorizationBlocks({}, { ...terminal, stdoutIsTTY: false }).length)
  // Passing this gate means an interactive executor is eligible, not that user approval has been proven.
  assert.deepEqual(writeAuthorizationBlocks({}, terminal), [])
})

test('errors/logs remove full URLs and both encoded and decoded passwords', () => {
  const secret = url.replace('example-password', 'secret%24password')
  const text = redactText(`failure ${secret} secret%24password secret$password`, secret)
  assert.ok(!text.includes('secret'))
  assert.ok(!text.includes('postgresql://'))
})

test('package generation, all source bytes and version files remain bound', () => {
  assert.deepEqual(offlineCheck().blocks, [])
})

test('read-only measured remote checkpoint still admits DB-1 and rejects DB-2', () => {
  const pre = JSON.parse(fs.readFileSync(new URL('../../../docs/research/factory-i1-deploy-286-independent/remote-preflight.json', import.meta.url))).preflight
  assert.deepEqual(evaluatePreflight('db1', pre), [])
  assert.ok(evaluatePreflight('db2', pre).some((b) => b.includes('[db1-first]')))
  const changed = structuredClone(pre)
  changed.history.versions_after_20261014091841 = ['20261016000000']
  assert.ok(evaluatePreflight('db1', changed).some((b) => b.includes('[history]')))
})
