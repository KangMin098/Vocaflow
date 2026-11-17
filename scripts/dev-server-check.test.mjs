// scripts/dev-server-check.test.mjs — a stale owner file must not certify an old worktree's server.
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDevServerOrigin } from './dev-server-check.mjs'

const mainWorktree = 'D:/workspace/Vocaflow-main-serving'
const owner = { pid: 123, cwd: 'D:\\workspace\\Vocaflow-main-serving\\apps\\web' }
const check = options => checkDevServerOrigin({ mainWorktree, owner, listenerPids: [123], ...options })

test('canonical cwd and the actual listening PID must both match', () => {
  assert.equal(check({}).ok, true)
  assert.equal(check({ listenerPids: [123, 123] }).ok, true)
  assert.equal(check({ owner: { ...owner, cwd: 'd:/WORKSPACE/Vocaflow-main-serving/apps/web/' } }).ok, true)
})
test('the observed incident: stale canonical owner plus an old worktree listener fails', () => {
  assert.equal(check({ listenerPids: [456] }).reason, 'wrong_listener')
  assert.equal(check({ owner: { pid: 456, cwd: 'D:/workspace/Vocaflow/apps/web' }, listenerPids: [456] }).reason, 'wrong_directory')
})
test('missing owner, no listener, and conflicting IPv4/IPv6 owners cannot pass', () => {
  assert.equal(check({ owner: null }).reason, 'missing_owner')
  assert.equal(check({ owner: { cwd: owner.cwd } }).reason, 'missing_owner')
  assert.equal(check({ listenerPids: [] }).reason, 'wrong_listener')
  assert.equal(check({ listenerPids: [123, 456] }).reason, 'wrong_listener')
})
