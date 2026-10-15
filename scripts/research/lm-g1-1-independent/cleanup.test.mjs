// scripts/research/lm-g1-1-independent/cleanup.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupOwnedAccounts } from './cleanup.mjs'

const absent = { error: { status: 404, code: 'user_not_found' }, data: { user: null } }
test('explicit successful deletion plus confirmed absence succeeds', async () => {
  const r = await cleanupOwnedAccounts({ deleteUser: async () => ({ error: null }), getUserById: async () => absent }, ['owned'])
  assert.equal(r.ok, true)
  assert.equal(r.accountsLeft, 0)
})
test('delete and lookup errors cannot produce accountsLeft zero or success', async () => {
  const r = await cleanupOwnedAccounts({ deleteUser: async () => ({ error: { status: 500 } }), getUserById: async () => ({ error: { status: 503 }, data: { user: null } }) }, ['owned'])
  assert.equal(r.ok, false)
  assert.equal(r.accountsLeft, null)
  assert.equal(r.unknown, 1)
})
test('remaining user is counted and fails', async () => {
  const r = await cleanupOwnedAccounts({ deleteUser: async () => ({ error: null }), getUserById: async () => ({ error: null, data: { user: { id: 'owned' } } }) }, ['owned'])
  assert.equal(r.ok, false)
  assert.equal(r.accountsLeft, 1)
})
test('empty success response and unrelated 404 do not establish absence', async () => {
  for (const response of [{ error: null, data: { user: null } }, { error: { status: 404, code: 'wrong_endpoint' } }]) {
    const r = await cleanupOwnedAccounts({ deleteUser: async () => ({ error: null }), getUserById: async () => response }, ['owned'])
    assert.equal(r.ok, false)
    assert.equal(r.accountsLeft, null)
  }
})
test('thrown transport errors fail closed', async () => {
  const r = await cleanupOwnedAccounts({ deleteUser: async () => { throw new Error('offline') }, getUserById: async () => { throw new Error('offline') } }, ['owned'])
  assert.equal(r.ok, false)
  assert.equal(r.accountsLeft, null)
})
