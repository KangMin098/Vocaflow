// agents/scripts/__tests__/codex-route-binding.test.mjs — 인계 재사용 · 상한 · 판정 SHA 결속 · P0/P1 추출(실제 Codex 호출 없음)
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MAX_ROUNDS, bindVerdict, goalCriteria, handoffBody, parseVerdict, planHandoff, readReplies, reviewKey } from '../codex-route.mjs'

const TASK = 'FINAL-FI011-SUPPLY'
const HEAD = '90cff014d0f1a2b3c4d5e6f708192a3b4c5d6e7f'
// 2026-10-19 실제 응답 모양(요약) — 판정 · SHA · P1 줄
const REPLY = `[VF-TASK ${TASK}] ACK\n\n**90cff014d: B stage fix CODE_VERIFIED; A PARTIAL / REWORK.**\n\n1. **P1 — wrong guided answer blocks repair permanently.** Permit a visible retry.\n2. **P1 — instruction counted as recheck/transfer.** Use one shared predicate.\nP0 없음.`

test('reviewKey — HEAD · diff · 수용 기준 중 하나라도 다르면 다른 키', () => {
  const k = reviewKey({ head: HEAD, diff: 'd', criteria: ['a'] })
  assert.equal(k, reviewKey({ head: HEAD, diff: 'd', criteria: ['a'] }))
  assert.notEqual(k, reviewKey({ head: HEAD, diff: 'd2', criteria: ['a'] }))
  assert.notEqual(k, reviewKey({ head: HEAD, diff: 'd', criteria: ['b'] }))
  assert.notEqual(k, reviewKey({ head: 'x' + HEAD.slice(1), diff: 'd', criteria: ['a'] }))
})

test('planHandoff — 같은 키 판정 재사용 · 보낸 뒤 대기 · 새 키 전송', () => {
  const ledger = { tasks: { [TASK]: { rounds: [{ round: 1, head: HEAD, key: 'k1', verdict: 'REWORK' }, { round: 2, head: 'h2', key: 'k2', verdict: null }] } } }
  assert.equal(planHandoff(ledger, TASK, 'k1').action, 'reuse')
  assert.equal(planHandoff(ledger, TASK, 'k2').action, 'pending')
  assert.deepEqual(planHandoff(ledger, TASK, 'k3'), { action: 'send', round: 3 })
  assert.deepEqual(planHandoff({ tasks: {} }, 'NEW-TASK', 'k'), { action: 'send', round: 1 })
})

test('planHandoff — 상한 도달은 보내지 않고 FIX_REQUIRED | REVIEW_UNKNOWN 으로 분류(우회 없음)', () => {
  const rounds = (last) => Array.from({ length: MAX_ROUNDS }, (_, i) => ({ round: i + 1, head: `h${i}`, key: `k${i}`, verdict: i === MAX_ROUNDS - 1 ? last : 'REWORK' }))
  assert.deepEqual(planHandoff({ tasks: { [TASK]: { rounds: rounds('REWORK') } } }, TASK, 'new'), { action: 'cap', status: 'FIX_REQUIRED', rounds: MAX_ROUNDS })
  const unknown = { tasks: { [TASK]: { rounds: rounds(null).map((r) => ({ ...r, verdict: null })) } } }
  assert.equal(planHandoff(unknown, TASK, 'new').status, 'REVIEW_UNKNOWN')
})

test('parseVerdict — 판정 · SHA 결속 · P0/P1 추출(「P0 없음」 은 지적이 아니다)', () => {
  const v = parseVerdict(REPLY, { task: TASK, head: HEAD })
  assert.equal(v.verdict, 'REWORK')
  assert.equal(v.bound, true)
  assert.equal(v.issues.length, 2)
  assert.ok(v.issues.every((i) => i.sev === 'P1'))
  assert.equal(parseVerdict(REPLY, { task: TASK, head: 'e44ac65df9c769be967b4e150f4a70ee53f479aa' }).bound, false, '다른 커밋의 판정은 이 커밋에 결속하지 않는다')
  assert.equal(parseVerdict(`[VF-TASK OTHER] ACK REWORK ${HEAD}`, { task: TASK, head: HEAD }), null, '다른 작업 ID 의 응답은 무시')
})

test('bindVerdict — 보낸 뒤 · 같은 SHA 응답만 판정으로 기록, REWORK 면 P0/P1 만 수정 목록', () => {
  const ledger = { tasks: { [TASK]: { rounds: [{ round: 1, head: HEAD, key: 'k', sentAt: '2026-10-19T07:19:00Z', verdict: null }] } } }
  assert.equal(bindVerdict(ledger, TASK, HEAD, []).status, 'waiting')
  assert.equal(bindVerdict(ledger, TASK, HEAD, [{ at: '2026-10-19T07:00:00Z', text: REPLY }]).status, 'waiting', '보내기 전 응답은 이번 라운드 판정이 아니다')
  assert.equal(bindVerdict(ledger, TASK, HEAD, [{ at: '2026-10-19T07:34:00Z', text: REPLY.replaceAll('90cff014d', 'e44ac65df') }]).status, 'unbound')
  const r = bindVerdict(ledger, TASK, HEAD, [{ at: '2026-10-19T07:34:00Z', text: REPLY }])
  assert.equal(r.status, 'bound')
  assert.equal(r.fix.length, 2)
  assert.equal(ledger.tasks[TASK].rounds[0].verdict, 'REWORK')
  assert.equal(bindVerdict(ledger, TASK, 'deadbeef', []).status, 'not_sent')
})

test('readReplies — 세션 기록의 task_complete 중 그 작업 ID 로 시작하는 응답만', () => {
  const rows = [
    { timestamp: 't1', payload: { type: 'task_complete', last_agent_message: REPLY } },
    { timestamp: 't2', payload: { type: 'task_complete', last_agent_message: `[VF-TASK OTHER] ${TASK}` } },
    { timestamp: 't3', payload: { type: 'agent_message', message: REPLY } },
  ].map((x) => JSON.stringify(x)).join('\n')
  assert.deepEqual(readReplies(rows, TASK).map((r) => r.at), ['t1'])
})

test('goalCriteria · handoffBody — 수용 기준 절 파싱 · 이전 P0/P1 을 인계문에 싣는다', () => {
  assert.deepEqual(goalCriteria('# 목적\nx\n\n## 수용 기준\n- [ ] 오답 뒤 재시도\r\n1. 공통 판정\n\n## 하지 않을 것\n- DB'), ['오답 뒤 재시도', '공통 판정'])
  assert.deepEqual(goalCriteria('없음'), [])
  const body = handoffBody({ files: ['a.ts'], evidence: 'plan 22/22', prior: { head: HEAD, verdict: 'REWORK', issues: [{ sev: 'P1', text: 'retry' }] } })
  assert.match(body, /a\.ts/)
  assert.match(body, /plan 22\/22/)
  assert.match(body, /\[P1\] retry/)
})

test('실측 반례 — 숫자만인 댓글 번호는 SHA 가 아니고, 링크한 댓글 본문으로 결속한다', async () => {
  const { linkedComments } = await import('../codex-route.mjs')
  const short = `[VF-TASK ${TASK}] ACK\n**판정: REWORK — 잔여 P1 한 건.**\n[반환](https://github.com/KangMin098/Vocaflow/pull/303#issuecomment-6262925253)`
  assert.deepEqual(parseVerdict(short, { task: TASK, head: HEAD }).shas, [])
  const fakeGh = (bin, argv) => { assert.equal(bin, 'gh'); assert.match(argv[1], /issues\/comments\/6262925253$/); return `Original four cases fixed at ${HEAD}. **P1** residual: authored repeat.` }
  const v = parseVerdict(`${short}\n${linkedComments(short, fakeGh)}`, { task: TASK, head: HEAD })
  assert.equal(v.bound, true)
  assert.equal(v.verdict, 'REWORK')
  assert.ok(v.issues.length >= 1)
})
