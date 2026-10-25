// scripts/db/csat-content-fix/deploy.test.mjs — node --test scripts/db/csat-content-fix/deploy.test.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { applyAuthorizationBlocks, offlineCheck, STAGES } from './deploy.mjs'

const nonce = 'a'.repeat(48)
const stage = 'hk-meta-r2'
const ok = { stage, confirmSha: STAGES[stage].sha256 }

test('본문 SQL 은 승인 SHA 와 바이트가 같을 때만 통과 · 없는 파일 · 한 글자 차이는 차단', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccf-'))
  const f = path.join(dir, 'x.sql')
  fs.writeFileSync(f, 'select 1;\n')
  assert.match(offlineCheck(stage, f).blocks.join(), /sha256/)
  assert.match(offlineCheck(stage, path.join(dir, 'none.sql')).blocks.join(), /없다/)
  const body = 'select 2;\n'
  fs.writeFileSync(f, body)
  const sha = crypto.createHash('sha256').update(body).digest('hex')
  const saved = STAGES[stage].sha256
  try {
    STAGES[stage].sha256 = sha
    assert.deepEqual(offlineCheck(stage, f).blocks, [])
    assert.equal(offlineCheck(stage, f).text, body)
  } finally { STAGES[stage].sha256 = saved }
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

test('단계마다 전체 SHA-256 과 검증 SQL 이 있다 · 검증은 읽기 전용 select', () => {
  for (const [name, st] of Object.entries(STAGES)) {
    assert.match(st.sha256, /^[0-9a-f]{64}$/, name)
    assert.match(st.verify.trim(), /^select /i, name)
    assert.doesNotMatch(st.verify, /\b(insert|update|delete|drop|truncate|alter)\b/i, name)
  }
})
