// tests/speed-metrics.test.mjs — 목표 속도 지표: 겹친 구간 합치기 · 배정→전달→인수 · 테스트/UI 소요 · PR·CI·병합 · 미계측은 사유
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalMetrics, unionMs } from '../lib/perf.mjs'
import { pendingFor, message } from '../hooks/dispatch-notify.mjs'

const T = (h, m = 0) => `2026-10-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

test('unionMs: 병렬 구간을 두 번 세지 않는다 · 떨어진 구간은 더한다 · 깨진 구간은 버린다', () => {
  assert.equal(unionMs([[T(1), T(2)], [T(1, 30), T(2, 30)]]), 90 * 60_000)
  assert.equal(unionMs([[T(1), T(2)], [T(3), T(4)]]), 120 * 60_000)
  assert.equal(unionMs([[T(2), T(1)], [null, T(1)]]), 0)
})

test('goalMetrics: 배정→전달·전달→인수 분리 · 테스트/UI 소요(병렬 합침) · PR·CI·병합 · 기록 없는 값은 null + 사유', () => {
  const task = {
    task_id: 'T-1', user_goal_id: 'UG-1', status: 'COMPLETED', design_version: 1, pr: 7,
    dispatch: { at: T(2), accepted_at: T(3) },
    history: [{ at: T(3), to: 'IN_PROGRESS' }, { at: T(4), from: 'IN_PROGRESS', to: 'REVIEW' }, { at: T(4, 10), from: 'REVIEW', to: 'COMPLETED' }],
    evidence: [
      { type: 'unit', started_at: T(3, 30), observed_at: T(3, 40) },
      { type: 'ci', started_at: T(3, 35), observed_at: T(3, 50) }, // unit 과 겹친다 → 3:30~3:50 = 20분
      { type: 'ui', started_at: T(3, 50), observed_at: T(3, 58) },
      { type: 'log', observed_at: T(3, 59) }, // started_at 없음 → 미계측 1건
    ],
  }
  const state = {
    userGoals: { goals: { 'UG-1': { ug_id: 'UG-1', status: 'OPEN', created_at: T(0), designs: [{ version: 1, created_at: T(1), approved_at: T(1, 30) }], rounds: [{ recipient: 'chatgpt', created_at: T(0, 10), completed_at: T(0, 40), response_status: 'APPLIED' }, { recipient: 'chatgpt', created_at: T(0, 30), completed_at: T(0, 50), response_status: 'APPLIED' }] } } },
    taskQueue: { tasks: [task] },
    decisionLog: { entries: [] },
  }
  const notified = [{ task_id: 'T-1', dispatched_at: T(2), notified_at: T(2, 1) }, { task_id: 'T-1', dispatched_at: T(2), notified_at: T(2, 5) }]
  const prRecords = { 7: { pr: 7, pr_created_at: T(4), ci_started_at: T(4, 1), ci_completed_at: T(4, 9), merged_at: T(4, 20) } }
  const m = goalMetrics(state, 'UG-1', { now: T(5), notified, prRecords })
  const t = m.tasks[0]
  assert.equal(t.dispatch_to_notify_ms, 60_000, '첫 전달 기록 기준(중복 알림은 무시)')
  assert.equal(t.notify_to_claim_ms, 59 * 60_000)
  assert.equal(t.test_ms, 20 * 60_000)
  assert.equal(t.ui_verify_ms, 8 * 60_000)
  assert.equal(t.ci_ms, 8 * 60_000)
  assert.equal(t.pr_to_merge_ms, 20 * 60_000)
  assert.equal(m.work_wait_ms, 40 * 60_000, '겹친 Work 대기는 합쳐서')
  assert.match(m.not_measured.test_and_ui_duration, /1건/)
  assert.equal(m.not_measured.pr_ci_merge, undefined)
  // 기록이 없으면 0 이 아니라 null + 사유
  const bare = goalMetrics({ ...state, taskQueue: { tasks: [{ ...task, pr: null, evidence: [] }] } }, 'UG-1', { now: T(5) })
  assert.equal(bare.tasks[0].dispatch_to_notify_ms, null)
  assert.equal(bare.tasks[0].test_ms, null)
  assert.ok(bare.not_measured.dispatch_notify && bare.not_measured.pr_ci_merge)
})

test('배정 알림 훅: 세션 id 별칭 또는 owner worktree 안 cwd 만 · 인수된·알린 작업은 다시 알리지 않는다', () => {
  const ownership = { owners: { 'learning-map': { session_aliases: ['sess-A'], worktrees: [{ path: 'd:/workspace/vocaflow-map-feedback' }] }, 'csat-learning': { session_aliases: [{ label: 'vocaflow-f5' }], worktrees: [] } } }
  const taskQueue = { tasks: [
    { task_id: 'T-9', title: '지도', status: 'READY', dispatch: { to: 'learning-map', at: T(3), accepted_at: null }, allowed_paths: ['a'], ui_gate: true },
    { task_id: 'T-8', title: '인수됨', status: 'IN_PROGRESS', dispatch: { to: 'learning-map', at: T(2), accepted_at: T(2, 5) } },
    { task_id: 'T-7', title: '남의 것', status: 'READY', dispatch: { to: 'csat-learning', at: T(3) } },
  ] }
  assert.deepEqual(pendingFor({ ownership, taskQueue, sessionId: 'sess-A', cwd: 'c:/x' }).tasks.map((t) => t.task_id), ['T-9'])
  assert.deepEqual(pendingFor({ ownership, taskQueue, sessionId: 'other', cwd: 'D:\\workspace\\Vocaflow-map-feedback\\apps' }).tasks.map((t) => t.task_id), ['T-9'], 'owner worktree 안이면 별칭이 없어도')
  assert.deepEqual(pendingFor({ ownership, taskQueue, sessionId: 'other', cwd: 'd:/workspace/Vocaflow' }).tasks, [], '모르는 세션에는 알리지 않는다')
  assert.deepEqual(pendingFor({ ownership, taskQueue, sessionId: 'vocaflow-f5', cwd: '' }).tasks.map((t) => t.task_id), ['T-7'], '객체 별칭({label})도')
  assert.deepEqual(pendingFor({ ownership, taskQueue, sessionId: 'sess-A', cwd: '', notified: [`T-9@${T(3)}`] }).tasks, [], '이미 알린 배정은 다시 알리지 않는다')
  assert.match(message([taskQueue.tasks[0]]), /T-9.*UI Quality Gate/)
})

test('task link-pr: 담당 owner 만 · 양의 정수만', async () => {
  const { linkPr } = await import('../lib/tasks.mjs')
  const state = { taskQueue: { tasks: [{ task_id: 'T-1', owner_id: 'o' }] } }
  assert.deepEqual(linkPr(state, 'T-1', '196', { caller: 'o' }), { task_id: 'T-1', pr: 196 })
  assert.throws(() => linkPr(state, 'T-1', '196', { caller: 'x' }), { code: 'NOT_OWNER' })
  assert.throws(() => linkPr(state, 'T-1', 'abc', { caller: 'o' }), { code: 'BAD_FIELD' })
})
