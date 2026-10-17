// agents/scripts/__tests__/db-approval.test.mjs
// 실행: node --test agents/scripts/__tests__
//
// 승인형 DB 배포 — 승인 창에서 허용된 명령에만 실리는 1회용 난수(updatedInput)로 티켓을 소비한다.
// 거부된 승인 창의 티켓 · 승인 창을 거치지 않은 실행(작업 디렉터리 이동 · 복사본 · node -e) 은 난수가 없어 쓸 수 없다.
// 반례 출처: PR #287 독립 리뷰(2026-10-18) P1-1 · P1-2 · P2.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { handle } from '../db-approval-hook.mjs'
import { NONCE_FLAG, TICKET_TTL_MS, consumeTicket, issueTicket, parseApply } from '../db-approval.mjs'
import { explain } from '../guard.mjs'
import { ROOT } from '../lib.mjs'

const SHA = '061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624'
const OTHER = 'f'.repeat(64)
const T0 = Date.parse('2026-10-18T00:00:00Z')
const CMD = `node scripts/db/factory-i1/deploy.mjs apply --stage db1 --confirm-sha ${SHA}`
const SUBJ = { runner: 'factory-i1', stage: 'db1', sha: SHA }
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vf-approval-'))
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command }, session_id: 's1' })
const nonceOf = (command) => command.split(' ').at(-1)

test('parseApply: 정식 형태만 ok', () => {
  assert.deepEqual(parseApply(CMD.split(' ').slice(1)), { ...SUBJ, ok: true })
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', 'verify', '--stage', 'db1']), null)
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', 'apply', '--stage', 'db1']).ok, false)
  assert.equal(parseApply(['scripts/db/factory-i1/deploy.mjs', '--stage', 'db1', 'apply', '--confirm-sha', SHA]).ok, false)
  assert.equal(parseApply([...CMD.split(' ').slice(1), NONCE_FLAG, 'a'.repeat(48)]).ok, false)
})

test('허용된 명령의 난수로만 1회 소비 — 재사용 불가 · 파일엔 난수 원문 없음', () => {
  const dir = tmp()
  const { nonce, file } = issueTicket({ ...SUBJ, now: T0, dir })
  assert.ok(!fs.readFileSync(file, 'utf8').includes(nonce))
  assert.equal(consumeTicket({ ...SUBJ, nonce, now: T0 + 1000, dir }).ticket?.sha, SHA)
  assert.equal(consumeTicket({ ...SUBJ, nonce, now: T0 + 2000, dir }).ticket, null)
})

test('P1-1: 거부된 승인 창의 티켓은 난수 없이 · 다른 난수로 쓸 수 없다', () => {
  const dir = tmp()
  issueTicket({ ...SUBJ, now: T0, dir }) // 사용자가 거부 → 난수가 실린 명령은 실행되지 않았다
  assert.equal(consumeTicket({ ...SUBJ, nonce: undefined, now: T0, dir }).ticket, null)
  assert.equal(consumeTicket({ ...SUBJ, nonce: 'b'.repeat(48), now: T0, dir }).ticket, null)
})

test('다른 SHA · 단계 · 러너 · 만료 · 미래 발급은 소비 못 한다', () => {
  const dir = tmp()
  const { nonce } = issueTicket({ ...SUBJ, now: T0, dir })
  assert.equal(consumeTicket({ ...SUBJ, sha: OTHER, nonce, now: T0, dir }).ticket, null)
  assert.equal(consumeTicket({ ...SUBJ, stage: 'db2', nonce, now: T0, dir }).ticket, null)
  assert.equal(consumeTicket({ ...SUBJ, runner: 'other', nonce, now: T0, dir }).ticket, null)
  assert.match(consumeTicket({ ...SUBJ, nonce, now: T0 + TICKET_TTL_MS, dir }).reason, /만료/)
  assert.equal(consumeTicket({ ...SUBJ, nonce, now: T0 - 1, dir }).ticket, null)
  assert.ok(consumeTicket({ ...SUBJ, nonce, now: T0 + 1, dir }).ticket)
})

test('훅: Claude 대화형 정식 명령 → ask + 난수가 붙은 updatedInput, 그 난수로 소비된다', () => {
  const dir = tmp()
  const r = handle(bash(CMD), { agent: 'claude', env: {}, now: T0, dir })
  assert.equal(r.deny.length, 0)
  assert.ok(r.ask.command.startsWith(`${CMD} ${NONCE_FLAG} `))
  assert.match(r.ask.reason, new RegExp(SHA))
  assert.ok(consumeTicket({ ...SUBJ, nonce: nonceOf(r.ask.command), now: T0 + 1, dir }).ticket)
  assert.ok(explain(CMD).some((x) => x.includes(SHA)), 'guard 도 같은 명령에 승인 사유를 낸다')
})

test('훅: Codex · 자동 실행 · CI · AGENT_GUARD_ASK=0 은 발급하지 않는다', () => {
  for (const [agent, env] of [['codex', {}], ['claude', { VFC_AUTOMATED_RUN: '1' }], ['claude', { CI: 'true' }], ['claude', { AGENT_GUARD_ASK: '0' }]]) {
    const dir = tmp()
    const r = handle(bash(CMD), { agent, env, now: T0, dir })
    assert.equal(r.ask, null, `${agent} ${JSON.stringify(env)}`)
    assert.equal(fs.readdirSync(dir).length, 0)
  }
})

test('훅: 변형 호출 · 직접 붙인 난수 · 티켓 디렉터리 쓰기는 발급 없이 거부(P1-1 · P1-2)', () => {
  const DENY = [
    `bash -c "${CMD}"`,
    `cd scripts/db/factory-i1 && node deploy.mjs apply --stage db1 --confirm-sha ${SHA}`,
    `node deploy.mjs apply --stage db1 --confirm-sha ${SHA}`,
    `node scripts/db/factory-i1/./deploy.mjs apply --stage db1 --confirm-sha ${SHA}`,
    `node scripts/db/factory-i1/deploy apply --stage db1 --confirm-sha ${SHA}`,
    `node scripts/db/factory-i1/deploy.mjs --stage db1 apply --confirm-sha ${SHA}`,
    `node -e "process.argv.push('apply');import('./scripts/db/factory-i1/deploy.mjs')"`,
    `node scripts/db/factory-i1/deploy.mjs apply --stage db1 --confirm-sha $SHA`,
    `node scripts/db/factory-i1/deploy.mjs apply --stage db1`,
    `${CMD} ${NONCE_FLAG} ${'a'.repeat(48)}`,
    `${CMD} && ${CMD}`,
    `cp x.json ~/.vocaflow/db-approvals/x.json`,
    `node -e "require('fs').writeFileSync(process.env.HOME+'/.vocaflow/db-approvals/x.json','{}')"`,
    `cat x > ~/.vocaflow/db-approvals/x.json`,
    `VF_DB_APPROVAL_DIR=/tmp/x ${CMD}`,
  ]
  for (const c of DENY) {
    const dir = tmp()
    const r = handle(bash(c), { agent: 'claude', env: {}, now: T0, dir })
    assert.ok(r.deny.length > 0, `거부돼야 함: ${c}`)
    assert.equal(r.ask, null, `승인 창이 뜨면 안 됨: ${c}`)
    assert.equal(fs.readdirSync(dir).length, 0, `발급되면 안 됨: ${c}`)
  }
})

test('훅 · guard: 조회 · 일상 명령은 건드리지 않는다(P2 오탐)', () => {
  const PASS = [
    'git status',
    `grep apply scripts/db/factory-i1/deploy.mjs`,
    `rg -n "deploy.mjs apply" docs`,
    `cat ~/.vocaflow/db-approvals/x.json`,
    `ls ~/.vocaflow/db-approvals`,
    `node scripts/db/factory-i1/deploy.mjs check`,
    `node scripts/db/factory-i1/deploy.mjs verify --stage db1 --deps ~/vf-deps`,
    `node scripts/db/factory-i1/deploy.mjs preflight --stage db1 --deps ~/vf-deps`,
    `git commit -m "docs: deploy.mjs apply 절차 scripts/db/factory-i1"`,
    'node --test agents/scripts/__tests__/db-approval.test.mjs',
    'pnpm --filter web test',
  ]
  for (const c of PASS) {
    const r = handle(bash(c), { agent: 'claude', env: {}, now: T0, dir: tmp() })
    assert.deepEqual(r, { deny: [], ask: null, tickets: [] }, c)
    assert.deepEqual(explain(c).filter((x) => /배포|티켓/.test(x)), [], `guard 오탐: ${c}`)
  }
})

test('settings: 배포 apply 에 allow 규칙이 없고 두 훅이 등록돼 있다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'))
  for (const rule of s.permissions?.allow ?? []) assert.ok(!/deploy|apply_migration|scripts\/db\//i.test(rule), `금지된 allow: ${rule}`)
  const pre = JSON.stringify(s.hooks?.PreToolUse ?? [])
  assert.match(pre, /guard\.mjs/)
  assert.match(pre, /db-approval-hook\.mjs/)
})
