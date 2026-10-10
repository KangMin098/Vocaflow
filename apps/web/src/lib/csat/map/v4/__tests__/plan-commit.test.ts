// apps/web/src/lib/csat/map/v4/__tests__/plan-commit.test.ts
// rev4.0 4차 — 계획 저장 요청 · 페이로드 · 저장본 적용 · 변경 감지(순수). 신뢰 경계: 클라이언트 가용량을 받지 않는다.

import { describe, expect, it } from 'vitest'

import { CANON_VERSION } from '../definition'
import type { WorkspacePlanView } from '../plan'
import { applySaved, buildCommitPayload, parseCommitRequest, planDrift, type SavedPlanVersion } from '../plan-commit'

const TPL = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']
const KEY = '3f1d6c1e-6b1a-4c2a-9d6e-2a4f1b9c8e71'
const view = (available: number | null = 9, done = 0): WorkspacePlanView => ({
  workspace: 'ws.central-meaning',
  core: ['r.central_meaning'],
  tasks: TPL.map((task, i) => ({
    task, name: task, goal: 'g', criterion: 'c', evidence: 'observed', basis: 'axis_proxy', relevance: null, need: i ? null : 'CONFIRM', priority: i ? null : 1,
    stage: i ? null : 'check', workspaces: [], next: null,
    quantity: i ? { unit: '문항', available: null, planned: null, done: 0, remaining: null, rule: null, source: 'none', adjustable: false }
      : { unit: '문항', available, planned: available, done, remaining: available === null ? null : Math.max(0, available - done), rule: available === null ? null : 'unseen_check_items', source: available === null ? 'none' : 'available_content', adjustable: available !== null },
    achievement: 'not_checked', unresolved: [],
  })) as WorkspacePlanView['tasks'],
  progress: available === null ? null : { planned: available, done: Math.min(done, available) },
})
const req = (o: Record<string, unknown> = {}) => ({ template: 'ws.central-meaning', order: TPL, planned: { 'r.central_meaning': 5 }, reason: 'initial', expectedVersion: 0, clientKey: KEY, ...o })

describe('요청 모양(parseCommitRequest) — 신뢰 경계', () => {
  it('정상 요청 통과', () => expect(parseCommitRequest(req()).ok).toBe(true))
  it('클라이언트가 보낸 가용량 · 사용자 id 등 모르는 칸은 거절(무시하지 않는다)', () => {
    expect(parseCommitRequest(req({ available: { 'r.central_meaning': 99 } }))).toEqual({ ok: false, code: 'unknown_field:available' })
    expect(parseCommitRequest(req({ userId: 'x' }))).toEqual({ ok: false, code: 'unknown_field:userId' })
  })
  it('경계값 — 음수 · 소수 · 1000 · 문자 계획량 거절, null · 0 허용', () => {
    for (const v of [-1, 1.5, 1000, '3']) expect(parseCommitRequest(req({ planned: { 'r.central_meaning': v } })).ok).toBe(false)
    for (const v of [null, 0, 999]) expect(parseCommitRequest(req({ planned: { 'r.central_meaning': v } })).ok).toBe(true)
  })
  it('요청 키 · 사유 · 복원 짝 검사', () => {
    expect(parseCommitRequest(req({ clientKey: 'abc' })).ok).toBe(false)
    expect(parseCommitRequest(req({ reason: 'hack' })).ok).toBe(false)
    expect(parseCommitRequest(req({ reason: 'restore' })).ok).toBe(false) // restoreOf 없음
    expect(parseCommitRequest(req({ reason: 'learner_adjust', restoreOf: 1 })).ok).toBe(false)
    expect(parseCommitRequest(req({ reason: 'restore', restoreOf: 1 })).ok).toBe(true)
  })
})

describe('페이로드(buildCommitPayload) — 서버가 가용량을 채운다', () => {
  const parsed = (o: Record<string, unknown> = {}) => (parseCommitRequest(req(o)) as { ok: true; req: Parameters<typeof buildCommitPayload>[0] }).req
  it('가용량 · 단계 · 규칙은 서버 보기에서, 계획량은 요청에서', () => {
    const b = buildCommitPayload(parsed(), view(9), '2026-10-11T00:00:00.000Z')
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(b.templateTasks).toEqual(TPL)
    expect(b.canon).toBe(CANON_VERSION)
    expect(b.plan.tasks[0]).toEqual({ task: 'r.central_meaning', stage: 'check', planned: 5, available: 9, rule: 'unseen_check_items' })
    expect(b.plan.tasks[1]).toMatchObject({ planned: null, available: null })
  })
  it('계획량 > 서버 가용량이면 자르지 않고 거절', () => {
    expect(buildCommitPayload(parsed({ planned: { 'r.central_meaning': 10 } }), view(9), 'x')).toMatchObject({ ok: false, status: 422, code: 'planned_over_available' })
  })
  it('가용량이 없는 TASK 에 계획량이면 거절(근거 없는 권장량 저장 불가)', () => {
    expect(buildCommitPayload(parsed({ planned: { 'r.discourse_function': 1 } }), view(9), 'x')).toMatchObject({ ok: false, code: 'planned_over_available' })
  })
  it('순서 — 중복 · 누락 · 모르는 TASK 거절', () => {
    expect(buildCommitPayload(parsed({ order: [TPL[0], TPL[0], TPL[2]] }), view(), 'x')).toMatchObject({ ok: false, code: 'order' })
    expect(buildCommitPayload(parsed({ order: [TPL[0], TPL[1]] }), view(), 'x')).toMatchObject({ ok: false, code: 'order' })
    expect(buildCommitPayload(parsed({ order: [TPL[0], TPL[1], 'v.core_meaning'] }), view(), 'x')).toMatchObject({ ok: false, code: 'order' })
    expect(buildCommitPayload(parsed({ planned: { 'v.core_meaning': 1 } }), view(), 'x')).toMatchObject({ ok: false, code: 'planned_task' })
  })
  it('보류 · 모르는 템플릿 · 지금 보기에 없는 템플릿 거절', () => {
    expect(buildCommitPayload(parsed({ template: 'ws.timed' }), view(), 'x')).toMatchObject({ ok: false, code: 'template_unknown' })
    expect(buildCommitPayload(parsed({ template: 'ws.nope' }), view(), 'x')).toMatchObject({ ok: false, code: 'template_unknown' })
    expect(buildCommitPayload(parsed(), null, 'x')).toMatchObject({ ok: false, code: 'template_not_available' })
  })
})

const savedV = (planned: number | null, available: number | null, canon = CANON_VERSION, order = TPL): SavedPlanVersion => ({
  version: 2, reason: 'learner_adjust', note: null, restoredFrom: null, canon, asOf: '2026-10-10T00:00:00Z', createdAt: '2026-10-10T00:00:00Z',
  plan: { order, tasks: TPL.map((task, i) => ({ task, stage: i ? null : 'check', planned: i ? null : planned, available: i ? null : available, rule: null })) },
})

describe('저장본 적용 · 변경 감지', () => {
  it('저장된 순서 · 계획량을 덮되 수행 · 근거는 지금 값', () => {
    const v = applySaved(view(9, 3), savedV(5, 9, CANON_VERSION, [TPL[2], TPL[0], TPL[1]]))
    expect(v.tasks.map((t) => t.task)).toEqual([TPL[2], TPL[0], TPL[1]])
    expect(v.tasks[1].quantity).toMatchObject({ planned: 5, done: 3, remaining: 2 })
    expect(v.tasks[1].evidence).toBe('observed')
    expect(v.progress).toEqual({ planned: 5, done: 3 })
  })
  it('수행이 계획보다 많아도 수행 수를 그대로 둔다(진행은 계획 기준 상한)', () => {
    const v = applySaved(view(9, 7), savedV(5, 9))
    expect(v.tasks[0].quantity.done).toBe(7)
    expect(v.progress).toEqual({ planned: 5, done: 5 })
  })
  it('가용량이 줄면 계획량을 지금 가용량으로 줄여 보이고 drift 로 알린다', () => {
    const now = view(4)
    expect(applySaved(now, savedV(6, 9)).tasks[0].quantity.planned).toBe(4)
    expect(planDrift(savedV(6, 9), now)).toEqual({ content: [{ task: 'r.central_meaning', saved: 9, now: 4 }], definition: false, overAvailable: ['r.central_meaning'] })
  })
  it('정의 버전이 바뀌면 definition drift', () => {
    expect(planDrift(savedV(5, 9, 'rev4.0-old'), view(9))?.definition).toBe(true)
    expect(planDrift(null, view(9))).toBeNull()
  })
})
