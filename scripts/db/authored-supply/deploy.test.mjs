// scripts/db/authored-supply/deploy.test.mjs — node --test scripts/db/authored-supply/deploy.test.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { applyAuthorizationBlocks, evaluate, offlineCheck, STAGES, VERIFY_SQL } from './deploy.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const nonce = 'a'.repeat(48)
const ok = { stage: 'authored', confirmSha: STAGES.authored.sha256 }
const db2 = { version: '20261017200100', name: 'factory_i1_db2_partial', sha256: 'x' }
const i2 = { version: '20261018120000', name: 'workspace_supply_c_annotation_binding', sha256: 'e7f7c16facd30124ec8a668701037d926a67c61dc1c5283c9ccbc79ce00c0b8c' }
const g2 = { version: '20261018120100', name: 'r5_delivery_g2_binding', sha256: '8043ce3bc712c26c0d0e42b11db2f2f7144848af2f2c7077fa57edc953dd4c2f' }
const mine = { version: STAGES.authored.version, name: STAGES.authored.name, sha256: STAGES.authored.sha256 }

test('승인 SHA = 승인 패키지 §A 의 SHA · 배포 본문 = 보류 SQL 바이트 그대로', () => {
  assert.equal(STAGES.authored.sha256, 'dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229')
  assert.deepEqual(offlineCheck('authored').blocks, [])
  const pending = fs.readFileSync(path.join(ROOT, 'supabase/migrations/_pending_authored_supply.sql'))
  const deploy = fs.readFileSync(path.join(ROOT, STAGES.authored.path))
  assert.ok(pending.equals(deploy), '두 파일 바이트가 같아야 한다')
  assert.equal(crypto.createHash('sha256').update(deploy).digest('hex'), STAGES.authored.sha256)
})

test('자동화 · CI 는 난수 · TTY 어느 경로든 거부', () => {
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.match(applyAuthorizationBlocks({ ...ok, approvalNonce: nonce }, { tty: false, env }).join(), /automated/)
    assert.match(applyAuthorizationBlocks(ok, { tty: true, env }).join(), /automated/)
  }
})

test('대화형 경로만 통과 · 비TTY 난수 없음 · SHA 불일치는 차단', () => {
  assert.deepEqual(applyAuthorizationBlocks({ ...ok, approvalNonce: nonce }, { tty: false, env: {} }), [])
  assert.deepEqual(applyAuthorizationBlocks(ok, { tty: true, env: { CI: 'false' } }), [])
  assert.match(applyAuthorizationBlocks(ok, { tty: false, env: {} }).join(), /nonce/)
  assert.match(applyAuthorizationBlocks({ ...ok, confirmSha: 'x' }, { tty: true, env: {} }).join(), /sha/)
})

test('순서 — G2 이력이 승인 SHA 와 같을 때만 · 이미 있으면 재적용 안 함', () => {
  assert.deepEqual(evaluate('authored', [db2, i2, g2], { mode: 'apply' }), [])
  assert.match(evaluate('authored', [db2, i2], { mode: 'apply' }).join(), /G2/)
  assert.match(evaluate('authored', [db2, i2, { ...g2, sha256: 'bad' }], { mode: 'apply' }).join(), /G2/)
  assert.match(evaluate('authored', [db2, i2, g2, mine], { mode: 'apply' }).join(), /already/)
  assert.match(evaluate('authored', [i2, g2], { mode: 'apply' }).join(), /DB-2/)
})

test('예상 밖 원격 이력은 차단 · verify 는 이력 SHA 필수', () => {
  assert.match(evaluate('authored', [db2, i2, g2, { version: '20261019000000', name: 'other', sha256: 'y' }], { mode: 'apply' }).join(), /예상 밖/)
  assert.deepEqual(evaluate('authored', [db2, i2, g2, mine], { mode: 'verify' }), [])
  assert.match(evaluate('authored', [db2, i2, g2], { mode: 'verify' }).join(), /history/)
})

test('사후 검증 — 사람 결정 행 0 · 창작 원장 0(러너는 표 · 함수만 만든다)', () => {
  const names = VERIFY_SQL.authored.map((q) => q.match(/select '([a-z_]+)'/)[1])
  assert.ok(names.includes('no_human_decisions_written'))
  assert.ok(names.includes('authored_items_empty'))
  assert.ok(names.includes('anon_cannot_execute_writers'))
})
