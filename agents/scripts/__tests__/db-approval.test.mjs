// agents/scripts/__tests__/db-approval.test.mjs
// 실행: node --test agents/scripts/__tests__
//
// 승인형 DB 배포 — 티켓은 (러너·단계·SHA) 에 묶이고 TTL 안에서 한 번만 쓰인다.
// 승인 창을 띄우는 쪽(guard 의 ask)과 발급하는 쪽(db-approval-hook)이 같은 명령을 보도록 판정을 공유한다.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { handle } from '../db-approval-hook.mjs'
import { TICKET_TTL_MS, consumeTicket, issueTicket, parseApply } from '../db-approval.mjs'
import { explain } from '../guard.mjs'
import { ROOT } from '../lib.mjs'

const SHA = '061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624'
const OTHER = 'f'.repeat(64)
const T0 = Date.parse('2026-10-18T00:00:00Z')
const CMD = `node scripts/db/factory-i1/deploy.mjs apply --stage db1 --confirm-sha ${SHA}`
const ENV = {}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vf-approval-'))
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command }, session_id: 's1' })

test('parseApply: 정식 형태만 ok', () => {
  assert.deepEqual(parseApply(CMD.split(' ').slice(1)), { runner: 'factory-i1', stage: 'db1', sha: SHA, ok: true })
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', 'verify', '--stage', 'db1']), null)
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', 'apply', '--stage', 'db1']).ok, false)
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', 'apply', '--stage', 'db1', '--confirm-sha', SHA.slice(0, 12)]).ok, false)
})

test('티켓: 발급 → 1회 소비 → 재사용 불가', () => {
  const dir = tmp()
  issueTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir })
  const a = consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0 + 1000, dir })
  assert.equal(a.ticket?.sha, SHA)
  const b = consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0 + 2000, dir })
  assert.equal(b.ticket, null)
})

test('티켓: 다른 SHA · 다른 단계 · 다른 러너는 소비 못 한다', () => {
  const dir = tmp()
  issueTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir })
  assert.equal(consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: OTHER, now: T0, dir }).ticket, null)
  assert.equal(consumeTicket({ runner: 'factory-i1', stage: 'db2', sha: SHA, now: T0, dir }).ticket, null)
  assert.equal(consumeTicket({ runner: 'other', stage: 'db1', sha: SHA, now: T0, dir }).ticket, null)
  assert.ok(consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir }).ticket)
})

test('티켓: TTL 이 지나면 무효 · 미래 발급도 무효', () => {
  const dir = tmp()
  issueTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir })
  const r = consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0 + TICKET_TTL_MS, dir })
  assert.equal(r.ticket, null)
  assert.match(r.reason, /만료/)
  const d2 = tmp()
  issueTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0 + 60_000, dir: d2 })
  assert.equal(consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir: d2 }).ticket, null)
})

test('티켓 디렉터리가 없으면 승인 없음', () => {
  const r = consumeTicket({ runner: 'factory-i1', stage: 'db1', sha: SHA, now: T0, dir: path.join(tmp(), 'none') })
  assert.equal(r.ticket, null)
})

test('훅: Claude 대화형 정식 명령에만 발급 — guard 는 같은 명령에 ask 사유를 낸다', () => {
  const dir = tmp()
  const r = handle(bash(CMD), { agent: 'claude', env: ENV, now: T0, dir })
  assert.equal(r.deny.length, 0)
  assert.equal(r.tickets.length, 1)
  assert.equal(r.tickets[0].session_id, 's1')
  assert.ok(explain(CMD).some((x) => x.includes(SHA)))
})

test('훅: Codex · 자동 실행 · CI · AGENT_GUARD_ASK=0 은 발급하지 않는다', () => {
  for (const [agent, env] of [
    ['codex', ENV],
    ['claude', { VFC_AUTOMATED_RUN: '1' }],
    ['claude', { CI: 'true' }],
    ['claude', { AGENT_GUARD_ASK: '0' }],
  ]) {
    const dir = tmp()
    const r = handle(bash(CMD), { agent, env, now: T0, dir })
    assert.equal(r.tickets.length, 0, `${agent} ${JSON.stringify(env)}`)
  }
})

test('훅: 변형 호출 · 티켓 디렉터리 접근은 발급 없이 거부', () => {
  const DENY = [
    `bash -c "${CMD}"`,
    `node scripts/db/factory-i1/deploy.mjs apply --stage db1 --confirm-sha $SHA`,
    `node scripts/db/factory-i1/deploy.mjs apply --stage db1`,
    `${CMD} && ${CMD}`,
    `cat ~/.vocaflow/db-approvals/x.json`,
    `node -e "require('fs').writeFileSync(process.env.HOME+'/.vocaflow/db-approvals/x.json','{}')"`,
    `VF_DB_APPROVAL_DIR=/tmp/x ${CMD}`,
  ]
  for (const c of DENY) {
    const dir = tmp()
    const r = handle(bash(c), { agent: 'claude', env: ENV, now: T0, dir })
    assert.ok(r.deny.length > 0, `거부돼야 함: ${c}`)
    assert.equal(r.tickets.length, 0, `발급되면 안 됨: ${c}`)
  }
})

test('훅: 일상 명령 · 읽기 명령은 건드리지 않는다', () => {
  const PASS = [
    'git status',
    `node scripts/db/factory-i1/deploy.mjs check`,
    `node scripts/db/factory-i1/deploy.mjs verify --stage db1 --deps ~/vf-deps`,
    `node scripts/db/factory-i1/deploy.mjs request --stage db1`,
    `git commit -m "docs: deploy.mjs apply 절차 scripts/db/factory-i1"`,
    'pnpm --filter web test',
  ]
  for (const c of PASS) {
    const r = handle(bash(c), { agent: 'claude', env: ENV, now: T0, dir: tmp() })
    assert.deepEqual(r, { deny: [], tickets: [] }, c)
  }
})

test('settings: 배포 apply 에 allow 규칙이 없고 훅이 등록돼 있다(있으면 클릭 없이 실행된다)', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'))
  for (const rule of s.permissions?.allow ?? []) assert.ok(!/deploy|apply_migration|scripts\/db\//i.test(rule), `금지된 allow: ${rule}`)
  const pre = JSON.stringify(s.hooks?.PreToolUse ?? [])
  assert.match(pre, /guard\.mjs/)
  assert.match(pre, /db-approval-hook\.mjs/)
})
