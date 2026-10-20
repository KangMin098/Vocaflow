// tests/mission-collaboration.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticReview, missionCollaboration, workBridgeAllowed } from '../lib/devmode.mjs'

const cfg = { mode: 'LOCAL_FAST', auto_codex_review: false, dynamic_roles: false,
  final_collaboration: { mission: 'FINAL-MISSION-A~H', owners: ['final-product'], auto_codex_review: true, dynamic_roles: true } }
const task = { owner_id: 'final-product', source: { mission: 'FINAL-MISSION-A~H' } }
test('FINAL opt-in requires both existing owner and explicit mission; ordinary work stays off', () => {
  assert.equal(automaticReview(task, { cfg, env: {} }), true)
  for (const t of [{ owner_id: task.owner_id }, { ...task, owner_id: 'another-owner' },
    { ...task, source: { mission: 'another-mission' } }, null]) {
    assert.equal(missionCollaboration(t, cfg), null)
    assert.equal(automaticReview(t, { cfg, env: {} }), false)
  }
  assert.equal(automaticReview(task, { cfg, env: { VFC_AUTO_CODEX: '0' } }), false)
  assert.equal(missionCollaboration(task, { ...cfg, mode: 'GITHUB' }), null)
})
test('LOCAL_FAST never enters Work transport merely because dynamic roles are disabled', () => {
  assert.equal(workBridgeAllowed(false, cfg), false)
  assert.equal(workBridgeAllowed(true, cfg), true)
  assert.equal(workBridgeAllowed(false, { ...cfg, dynamic_roles: true }), false)
  assert.equal(workBridgeAllowed(false, { mode: 'GITHUB' }), true)
})
