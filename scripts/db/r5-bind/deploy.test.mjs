// scripts/db/r5-bind/deploy.test.mjs — node --test scripts/db/r5-bind/deploy.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAuthorizationBlocks, evaluate, offlineCheck, STAGES } from './deploy.mjs'

const nonce = 'a'.repeat(48)
const ok = { stage: 'i2', confirmSha: STAGES.i2.sha256 }

test('automated/CI environments are blocked on both nonce and TTY paths', () => {
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.match(applyAuthorizationBlocks({ ...ok, approvalNonce: nonce }, { tty: false, env }).join(), /automated/)
    assert.match(applyAuthorizationBlocks(ok, { tty: true, env }).join(), /automated/)
  }
})

test('interactive paths pass; non-TTY without nonce and SHA mismatch block', () => {
  assert.deepEqual(applyAuthorizationBlocks({ ...ok, approvalNonce: nonce }, { tty: false, env: {} }), [])
  assert.deepEqual(applyAuthorizationBlocks(ok, { tty: true, env: { CI: 'false' } }), [])
  assert.match(applyAuthorizationBlocks(ok, { tty: false, env: {} }).join(), /nonce/)
  assert.match(applyAuthorizationBlocks({ ...ok, confirmSha: 'x' }, { tty: true, env: {} }).join(), /sha/)
})

const db2 = { version: '20261017200100', name: 'factory_i1_db2_partial', sha256: 'x' }
const i2 = { version: STAGES.i2.version, name: STAGES.i2.name, sha256: STAGES.i2.sha256 }
const g2 = { version: STAGES.g2.version, name: STAGES.g2.name, sha256: STAGES.g2.sha256 }

test('repository bodies match approved SHA', () => {
  for (const s of Object.keys(STAGES)) assert.deepEqual(offlineCheck(s).blocks, [])
})

test('i2 needs DB-2 and is not re-applied', () => {
  assert.deepEqual(evaluate('i2', [db2], { mode: 'apply' }), [])
  assert.match(evaluate('i2', [], { mode: 'apply' }).join(), /order/)
  assert.match(evaluate('i2', [db2, i2], { mode: 'apply' }).join(), /already/)
})

test('g2 needs I2 with approved SHA', () => {
  assert.match(evaluate('g2', [db2], { mode: 'apply' }).join(), /I2/)
  assert.match(evaluate('g2', [db2, { ...i2, sha256: 'bad' }], { mode: 'apply' }).join(), /I2/)
  assert.deepEqual(evaluate('g2', [db2, i2], { mode: 'apply' }), [])
  assert.match(evaluate('g2', [db2, i2, g2], { mode: 'apply' }).join(), /already/)
})

test('unexpected remote history blocks', () => {
  assert.match(evaluate('i2', [db2, { version: '20261018000000', name: 'other', sha256: 'y' }], { mode: 'apply' }).join(), /예상 밖/)
})

test('verify requires history SHA', () => {
  assert.deepEqual(evaluate('i2', [db2, i2], { mode: 'verify' }), [])
  assert.match(evaluate('i2', [db2], { mode: 'verify' }).join(), /history/)
})
