// tests/alignment.test.mjs — Goal Alignment Gate(lib/alignment.mjs) 회귀
//
// 실증 대상: 한국 영어학습 맵 rev2.1 — 정본 VG-L2-A1(진단/목표 모델) 아래 VG-L3-A1-01(목표/진단에서 계획 생성)·VG-L3-A1-02(불량 진단 데이터 처리).
// 상태는 메모리 사본(정본은 실제 goals/). 실패 사례 5종 + 중복·간접 선행·갭·독립 작업·다음 작업 선정·지연.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addTask } from '../lib/tasks.mjs'
import { loadCriteria } from '../lib/goals.mjs'
import { goalLevel, sameGoalPreference, pathsOverlap } from '../lib/alignment.mjs'

const doc = loadCriteria()
const OWNER_A = 'owner-map'
const OWNER_B = 'owner-other'
const MAP_L2 = 'VG-L2-A1'
const MAP_A = 'VG-L3-A1-01'
const MAP_B = 'VG-L3-A1-02'

function state() {
  return {
    taskQueue: { next_seq: 1, tasks: [] },
    ownership: { owners: { [OWNER_A]: { worktrees: [] }, [OWNER_B]: { worktrees: [] } } },
    goalStatus: { goals: {} },
    decisionLog: { entries: [] },
  }
}
const ac = (g) => doc.criteria.find((c) => c.id === g).acceptance[0].criterion_id
function spec(over = {}, impact = {}) {
  return {
    goal_id: MAP_A,
    title: 'map task',
    description: 'd',
    priority: 'P1',
    owner_id: OWNER_A,
    allowed_paths: ['apps/web/src/lib/csat/map/**'],
    forbidden_paths: ['supabase/**'],
    acceptance: ['조건'],
    created_by: OWNER_A,
    ...over,
    impact: { current_gap: '진단 전 원인 불확실성 표시가 없다', expected_impact: 'advances', evidence_required: ['vitest 통과'], ...impact },
  }
}
const add = (s, sp) => addTask(s, sp, { goalsDoc: doc })
const rejects = (fn, code) => assert.throws(fn, (e) => e.code === code, `기대 ${code}`)
const complete = (t) => Object.assign(t, { status: 'COMPLETED' })

test('실패 사례 1 — 학습 순환(하위 L3 하나) 완료를 전체 지도(L2) 완료로 판정하지 않는다', () => {
  const s = state()
  const t = complete(add(s, spec({ criterion_claims: [{ criterion_id: ac(MAP_A), claim: 'full' }] }, { expected_impact: 'closes' })))
  s.goalStatus.goals[MAP_A] = { status: 'PASS' }
  s.goalStatus.goals[MAP_L2] = { status: 'UNKNOWN' }
  assert.equal(goalLevel(s, MAP_A).level, 'GOAL_VERIFIED')
  assert.notEqual(goalLevel(s, MAP_L2).level, 'GOAL_VERIFIED', '하위 하나의 PASS 가 상위 지도 PASS 가 아니다')
  assert.deepEqual(goalLevel(s, MAP_A).tasks_done, [t.task_id])
})

test('실패 사례 1b — 비DB 기반 계약(A~F)은 간접 선행으로만: full claim 거부 · 완료해도 GOAL_PARTIAL 이 아니다', () => {
  const s = state()
  rejects(() => add(s, spec({ criterion_claims: [{ criterion_id: ac(MAP_A), claim: 'full' }] }, { expected_impact: 'prerequisite', dependency_type: 'prerequisite', unblocks: 'FIND→REPAIR→TRANSFER→CHECK 학생 경로' })), 'PREREQ_FULL_CLAIM')
  rejects(() => add(s, spec({}, { expected_impact: 'prerequisite', dependency_type: 'prerequisite' })), 'BAD_IMPACT') // unblocks 없음
  const t = complete(add(s, spec({}, { expected_impact: 'prerequisite', dependency_type: 'prerequisite', unblocks: 'verified_diagnosis 직접 진단 경로' })))
  assert.equal(t.impact.dependency_type, 'prerequisite')
  const lv = goalLevel(s, MAP_A)
  assert.equal(lv.level, 'TASK_COMPLETED', '간접 선행 완료는 목표 진전(GOAL_PARTIAL)으로 세지 않는다')
  assert.deepEqual(lv.prerequisite_done, [t.task_id])
})

test('실패 사례 2 — 이미 full 로 완료된 기능을 다시 구현하는 작업 거부(reopen_reason 이 있으면 허용·기록)', () => {
  const s = state()
  complete(add(s, spec({ criterion_claims: [{ criterion_id: ac(MAP_A), claim: 'full' }] }, { expected_impact: 'closes' })))
  rejects(() => add(s, spec({ allowed_paths: ['apps/web/src/lib/csat/map/prescription.ts'] })), 'REIMPLEMENT')
  const r = add(s, spec({ allowed_paths: ['apps/web/src/lib/csat/map/prescription.ts'], reopen_reason: 'main 변경으로 PASS 무효화(검사기 pass_invalidated)' }))
  assert.match(r.impact.reopen_reason, /무효화/)
})

test('실패 사례 3 — 다른 세션 작업의 금지사항이 이 작업의 승인 범위에 섞이지 않는다', () => {
  const s = state()
  // B 세션 작업은 map/** 를 금지한다 — A 세션의 다른 기준 작업은 그 금지에 묶이지 않는다
  add(s, spec({ goal_id: MAP_B, owner_id: OWNER_B, allowed_paths: ['apps/web/src/lib/knowledge/**'], forbidden_paths: ['apps/web/src/lib/csat/map/**'] }))
  const t = add(s, spec())
  assert.equal(t.owner_id, OWNER_A)
  assert.deepEqual(t.forbidden_paths, ['supabase/**'], '자기 계약의 금지만')
  // 반대로 자기 금지와 겹치는 범위는 기존 규칙대로(범위 판단은 자기 계약으로만)
  assert.ok(t.allowed_paths.every((p) => !p.startsWith('supabase/')))
})

test('실패 사례 4 — 사용자 승인 없는 수락 승격 차단: 에이전트 기록 결정은 USER_ACCEPTED 근거가 아니다', () => {
  const s = state()
  complete(add(s, spec({ criterion_claims: [{ criterion_id: ac(MAP_A), claim: 'full' }] }, { expected_impact: 'closes' })))
  s.goalStatus.goals[MAP_A] = { status: 'PASS' }
  s.decisionLog.entries.push({ decision_id: 'DL-0901', status: 'APPROVED', approved_by: 'user', recorded_via: 'agent', summary: `${MAP_A} accept` })
  assert.equal(goalLevel(s, MAP_A).level, 'GOAL_VERIFIED')
  s.decisionLog.entries.push({ decision_id: 'DL-0902', status: 'APPROVED', approved_by: 'user', summary: `${MAP_A} accept` })
  const lv = goalLevel(s, MAP_A)
  assert.equal(lv.level, 'USER_ACCEPTED')
  assert.equal(lv.decision_id, 'DL-0902')
  // PASS 전에는 사용자 결정이 있어도 수락 단계가 아니다
  s.goalStatus.goals[MAP_A] = { status: 'UNKNOWN' }
  assert.notEqual(goalLevel(s, MAP_A).level, 'USER_ACCEPTED')
})

test('실패 사례 5 — 증거 없는 원인 진단 완료 주장 거부(closes 인데 full 없음 · full 인데 advances · 증거 요구 없음)', () => {
  const s = state()
  rejects(() => add(s, spec({ goal_id: MAP_B }, { expected_impact: 'closes' })), 'BAD_IMPACT')
  rejects(() => add(s, spec({ goal_id: MAP_B, criterion_claims: [{ criterion_id: ac(MAP_B), claim: 'full' }] }, { expected_impact: 'advances' })), 'BAD_IMPACT')
  rejects(() => add(s, spec({ goal_id: MAP_B }, { evidence_required: [] })), 'BAD_IMPACT')
  rejects(() => add(s, { ...spec(), impact: undefined }), 'IMPACT_REQUIRED')
})

test('중복 작업 거부 — 열린 작업이 같은 기준·겹치는 경로를 다루면(다른 기준·다른 경로는 허용)', () => {
  const s = state()
  add(s, spec())
  rejects(() => add(s, spec({ allowed_paths: ['apps/web/src/lib/csat/map/core.ts'] })), 'DUPLICATE_TASK')
  assert.ok(add(s, spec({ allowed_paths: ['apps/web/src/components/csat/**'] })).task_id, '경로가 안 겹치면 허용')
  assert.ok(add(s, spec({ goal_id: MAP_B })).task_id, '다른 기준이면 허용')
  assert.ok(add(s, spec({ duplicate_reason: '의도적 병행 — 다른 접근 비교' })).impact.duplicate_reason)
})

test('갭 없음 거부 · 상위 목표 연결 검사 · 독립 작업은 정본에 억지로 묶지 않는다', () => {
  const s = state()
  s.goalStatus.goals[MAP_A] = { status: 'PASS' }
  rejects(() => add(s, spec()), 'GAP_CLOSED')
  rejects(() => add(s, spec({ goal_id: MAP_B }, { parent_goal_id: 'VG-L2-B1' })), 'BAD_PARENT_GOAL')
  assert.equal(add(s, spec({ goal_id: MAP_B }, { parent_goal_id: MAP_L2 })).impact.parent_goal_id, MAP_L2, '상위(L2) 연결 허용')
  rejects(() => add(s, spec({}, { kind: 'independent' })), 'BAD_IMPACT') // 요청 근거 없음
  const ind = add(s, spec({}, { kind: 'independent', user_request_ref: '사용자 메시지 2026-10-10 「…」' }))
  assert.deepEqual(ind.criterion_claims, [], '독립 작업은 정본 기준 PASS 근거가 되지 않는다')
  assert.equal(ind.impact.kind, 'independent')
})

test('다음 작업: 방금 끝난 작업과 같은 상위 목표·그 작업에 의존하는 작업이 먼저', () => {
  const last = { task_id: 'T-0001', parent_goal_id: MAP_A }
  assert.equal(sameGoalPreference({ goal_id: MAP_A, impact: { parent_goal_id: MAP_A } }, last), 0)
  assert.equal(sameGoalPreference({ goal_id: MAP_B, depends_on: ['T-0001'] }, last), 0)
  assert.equal(sameGoalPreference({ goal_id: MAP_B }, last), 1)
  assert.equal(sameGoalPreference({ goal_id: MAP_B }, null), 1)
  assert.equal(sameGoalPreference({ user_goal_id: 'UG-x-0002' }, { task_id: 'T-9', parent_goal_id: 'UG-x-0002' }), 0)
})

test('경로 겹침 판정 · 정렬 검사 지연(작업 300개에서 1건 등록)', () => {
  assert.ok(pathsOverlap(['a/b/**'], ['a/b/c.ts']))
  assert.ok(!pathsOverlap(['a/b/**'], ['a/c/**']))
  const s = state()
  for (let i = 0; i < 300; i++) s.taskQueue.tasks.push({ task_id: `T-${String(i + 1).padStart(4, '0')}`, goal_id: MAP_B, status: 'READY', allowed_paths: [`x/${i}/**`], criterion_claims: [{ criterion_id: ac(MAP_B), claim: 'partial' }] })
  s.taskQueue.next_seq = 301
  const t = add(s, spec())
  assert.ok(t.impact.gate_ms < 50, `정렬 검사 ${t.impact.gate_ms}ms`)
})

test('Codex P1 — 겨냥 밖 full claim 이 남아 선행 작업이 다른 기준의 PASS 근거가 되는 우회 차단', () => {
  const s = state()
  const claims = [{ criterion_id: ac(MAP_A), claim: 'partial' }, { criterion_id: ac(MAP_B), claim: 'full' }]
  rejects(() => add(s, spec({ related_goal_ids: [MAP_B], criterion_claims: claims }, { expected_impact: 'prerequisite', dependency_type: 'prerequisite', unblocks: 'x', acceptance_ids: [ac(MAP_A)] })), 'BAD_IMPACT')
  rejects(() => add(s, spec({ related_goal_ids: [MAP_B], criterion_claims: claims }, { acceptance_ids: [ac(MAP_A)] })), 'BAD_IMPACT')
})

test('Codex P2 — 리뷰 정렬 질문: 독립 작업은 자기 완료 조건 · 사용자 목표는 현재 설계 버전 기준', async () => {
  const { codexPromptAlignmentForTest } = await import('../lib/orchestrator.mjs')
  const ind = codexPromptAlignmentForTest({ acceptance: ['사용자 기준'], impact: { kind: 'independent', user_request_ref: 'msg-1' } })
  assert.match(ind, /independent/)
  assert.match(ind, /사용자 기준/)
  const ug = codexPromptAlignmentForTest({ user_goal_id: 'UG-x-0002', design_version: 2, design_acceptance: [0, 3], impact: { kind: 'user_goal', acceptance_ids: ['UG-x-0002@v1#0'] } })
  assert.match(ug, /UG-x-0002@v2#0/)
  assert.doesNotMatch(ug, /@v1#/)
})

test('Codex P2 — 사용자 목표 안의 간접 선행 작업도 full 금지 · unblocks 필수 · 정본 parent 순환에서도 멈춘다', async () => {
  const s = state()
  const ug = { user_goal_id: 'UG-x-0002', design_version: 1, design_acceptance: [0] }
  rejects(() => addTask(s, { ...spec(ug, { expected_impact: 'prerequisite', dependency_type: 'prerequisite' }) }, { goalsDoc: doc, ugBound: true }), 'BAD_IMPACT')
  rejects(() => addTask(s, { ...spec({ ...ug, criterion_claims: [{ criterion_id: ac(MAP_A), claim: 'full' }] }, { expected_impact: 'prerequisite', unblocks: 'x' }) }, { goalsDoc: doc, ugBound: true }), 'PREREQ_FULL_CLAIM')
  const t = addTask(s, spec(ug, { expected_impact: 'prerequisite', unblocks: '설계 기준 0' }), { goalsDoc: doc, ugBound: true })
  assert.equal(t.impact.dependency_type, 'prerequisite')
  const { ancestors } = await import('../lib/alignment.mjs')
  assert.deepEqual(ancestors({ criteria: [{ id: 'A', parent_id: 'B' }, { id: 'B', parent_id: 'A' }] }, 'A'), ['A', 'B'])
})
