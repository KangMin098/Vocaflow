// tests/popup-approval.test.mjs — DB 쓰기 승인의 승인 창(팝업) 티켓 경로(2026-10-23 사용자 지시)
// 지키는 것: 방금 소비된 · 같은 SQL sha · 같은 TASK 에 묶인 · 처음 쓰는 티켓만 통과. 근거 없는 에이전트 승인은 그대로 TRUST_REQUIRED.
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { recordApproval } from '../lib/tasks.mjs'

const SQL = 'a'.repeat(64)
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex')
const state = () => ({ taskQueue: { tasks: [{ task_id: 'T-9001', approval_kinds: ['db_write'], approval: null }, { task_id: 'T-9002', approval_kinds: ['db_write'], approval: null }] } })
function ticket(dir, { stage = 't9001', sha = SQL, nonce = 'n1', consumedAt = new Date().toISOString() } = {}) {
  const ns = hash(nonce)
  const f = path.join(dir, `authored-ai-record-${stage}-${sha}-${ns.slice(0, 8)}.json.consumed`)
  fs.writeFileSync(f, JSON.stringify({ v: 2, runner: 'authored-ai-record', stage, sha, nonce_sha256: ns, issued_at: consumedAt }) + '\n' + JSON.stringify({ consumed_at: consumedAt, pid: 1 }) + '\n')
  return ns
}
const withDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-popup-'))
  const prev = process.env.VF_DB_APPROVAL_DIR
  process.env.VF_DB_APPROVAL_DIR = dir
  try { fn(dir) } finally { if (prev === undefined) delete process.env.VF_DB_APPROVAL_DIR; else process.env.VF_DB_APPROVAL_DIR = prev; fs.rmSync(dir, { recursive: true, force: true }) }
}
const approve = (s, id, extra) => recordApproval(s, id, { by: 'user', reference: 'r', sql_sha256: SQL, ...extra })

test('팝업 티켓: 방금 소비된 같은 SQL · TASK 티켓이면 승인 기록(via=popup · 티켓 해시 보존)', () => withDir((dir) => {
  const s = state(); const ns = ticket(dir)
  const t = approve(s, 'T-9001', { via: 'popup', popup_ticket: ns })
  assert.equal(t.approval.via, 'popup'); assert.equal(t.approval.popup_ticket, ns)
}))

test('팝업 티켓: 근거 없는 에이전트 · 티켓 없음 · 다른 SQL · 다른 TASK · 오래된 소비 · 재사용은 거부', () => withDir((dir) => {
  assert.throws(() => approve(state(), 'T-9001', { via: 'agent' }), { code: "TRUST_REQUIRED" })
  assert.throws(() => approve(state(), 'T-9001', { via: 'popup', popup_ticket: hash('none') }), { code: "POPUP_TICKET" })
  const other = ticket(dir, { sha: 'b'.repeat(64), nonce: 'n2' })
  assert.throws(() => approve(state(), 'T-9001', { via: 'popup', popup_ticket: other }), { code: "POPUP_TICKET" })
  const wrongTask = ticket(dir, { stage: 't9002', nonce: 'n3' })
  assert.throws(() => approve(state(), 'T-9001', { via: 'popup', popup_ticket: wrongTask }), { code: "POPUP_TICKET" })
  const stale = ticket(dir, { nonce: 'n4', consumedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
  assert.throws(() => approve(state(), 'T-9001', { via: 'popup', popup_ticket: stale }), { code: "POPUP_TICKET" })
  const s = state(); const ns = ticket(dir, { nonce: 'n5' })
  approve(s, 'T-9001', { via: 'popup', popup_ticket: ns })
  assert.throws(() => approve(s, 'T-9001', { via: 'popup', popup_ticket: ns }), { code: "POPUP_TICKET", message: /이미 승인에 쓰인/ })
}))

test('팝업 티켓: 대화형 터미널(tty) 경로는 티켓 없이 그대로 통과', () => {
  assert.equal(approve(state(), 'T-9001', { via: 'tty' }).approval.via, 'tty')
})
