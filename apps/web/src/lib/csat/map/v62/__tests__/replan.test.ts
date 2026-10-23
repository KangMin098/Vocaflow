// apps/web/src/lib/csat/map/v62/__tests__/replan.test.ts
import { describe, expect, it } from 'vitest'

import type { TaskPlan } from '../../v4/plan'
import type { SavedPlans } from '../../v4/plan-store'
import type { GoalPlanRow } from '../goal-plan'
import { replanProposal as project, type ReplanInput } from '../replan'
import type { GoalVersion } from '../target-goal'

const TODAY = '2026-10-22' // 목
const goal: GoalVersion = { id: 5, score: 85, grade: null, exam: 'kice9', date: '2026-11-19', createdAt: '2026-09-01T00:00:00Z', budget: { weeklyMinutes: 140, dailyMinutes: null, minutesPerUnit: 10, priorities: [] } }

const row = (task: string, over: Partial<GoalPlanRow> = {}): GoalPlanRow => ({
  task, needRank: 1, need: 'REPAIR', evidence: 'verified_need', basis: 'direct_check', independentItems: 2, relevance: null,
  stage: 'repair', workspace: 'W1', quantity: { unit: '문항', planned: 3, done: 0, remaining: 3, source: 'saved' },
  criterion: null, achievement: 'need_confirmed', action: null, planGate: 'replan', replanWhy: 'content', blocked: null, unresolved: [],
  ...over,
} as GoalPlanRow)

const saved = (stage: string, planned: number, goalVersionId = 5): SavedPlans => ({
  status: 'installed', goalVersionId: 5, goal,
  byTemplate: { W1: { workspaceId: 'w1', template: 'W1', history: [], latest: { version: 2, plan: { order: ['v.core_meaning'], tasks: [{ task: 'v.core_meaning', stage, planned, available: planned, rule: null }] }, reason: 'initial', note: null, restoredFrom: null, canon: 'x', asOf: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', goalVersionId } } },
})

const plans = [{ task: 'v.core_meaning', next: { href: '/csat/item/r1', label: '다시 풀기' } }] as unknown as TaskPlan[]
const replanProposal = (input: Omit<ReplanInput, 'revisions'> & Partial<Pick<ReplanInput, 'revisions'>>) => project({ revisions: [{ workspace: 'W1', reason: 'check_result', newExam: false }], ...input })

describe('replanProposal', () => {
  it('다시 확정할 TASK 가 없으면 아무것도 제안하지 않는다', () => {
    expect(replanProposal({ goal, rows: [row('v.core_meaning', { planGate: null })], plans, saved: saved('repair', 3), today: TODAY }).none).toBe(true)
  })

  it('확인 실패로 확인 → 바로잡기 — 단계 변화 · 일정 비교 · 사유 check_result', () => {
    const p = replanProposal({ goal, rows: [row('v.core_meaning')], plans, saved: saved('check', 2), today: TODAY })
    expect(p.reasons).toEqual(['check_result'])
    expect(p.shifts).toEqual([expect.objectContaining({ task: 'v.core_meaning', from: { stage: 'check', planned: 2 }, to: { stage: 'repair', remaining: 3 } })])
    expect(p.changes).toEqual([{ task: 'v.core_meaning', before: 2, after: 3, reason: 'evidence_or_content' }])
    expect(p.thisWeek).toEqual({ current: 0, before: 20, after: 30 }) // 재확정 전이라 지금 일정엔 0
    expect(p.weekRows).toEqual([{ task: 'v.core_meaning', current: 0, before: 20, after: 30 }])
    expect(p.unchanged).toBe(false)
    expect(p.workspaces).toEqual(['W1'])
    // 투영은 저장 · 판정을 바꾸지 않는다 — 입력 행의 관문은 그대로
    expect(p.after!.allocations.every((a) => a.action?.href === '/csat/item/r1')).toBe(true)
    expect(p.before!.allocations.every(a => a.action === null)).toBe(true)
  })

  it('다시 확정이 필요해도 실제로 같으면 변화 없음', () => {
    const p = replanProposal({ goal, rows: [row('v.core_meaning')], plans, saved: saved('repair', 3), today: TODAY })
    expect(p.unchanged).toBe(true)
    expect(p.changes).toEqual([])
  })

  it('목표가 바뀌면 goal_change · 일정 변화 사유도 goal', () => {
    const state = saved('repair', 2, 4)
    state.goalHistory = [{ ...goal, id: 4, budget: { ...goal.budget!, weeklyMinutes: 70 } }, goal]
    const p = replanProposal({ goal, rows: [row('v.core_meaning', { replanWhy: 'goal' })], plans, saved: state, today: TODAY, revisions: [{ workspace: 'W1', reason: 'goal_change', newExam: false }] })
    expect(p.reasons).toContain('goal_change')
    expect(p.changes[0].reason).toBe('goal')
    expect(p.before!.goalVersion).toBe(4)
    expect(p.before!.weeks[0].capacity).toBeLessThan(p.after!.weeks[0].capacity)
  })

  it('저장 뒤 본 새 시험이 목표 미달이면 new_exam 사유', () => {
    expect(replanProposal({ goal, rows: [row('v.core_meaning')], plans, saved: saved('check', 2), today: TODAY, revisions: [{ workspace: 'W1', reason: 'check_result', newExam: true }] }).reasons).toEqual(['check_result', 'new_exam'])
  })

  it('예산 없는 목표는 일정 비교 없이 단계 변화만', () => {
    const p = replanProposal({ goal: { ...goal, budget: null }, rows: [row('v.core_meaning')], plans, saved: saved('check', 2), today: TODAY })
    expect(p.shifts).toHaveLength(1)
    expect(p.after!.status).toBe('missing_budget')
    expect(p.changes).toEqual([])
  })

  it('이전 목표 이력이 없으면 현재 예산으로 과거 PLAN을 꾸미지 않는다', () => {
    const p = replanProposal({ goal, rows: [row('v.core_meaning', { replanWhy: 'goal' })], plans, saved: saved('repair', 2, 4), today: TODAY })
    expect(p.before).toBeNull()
    expect(p.thisWeek).toBeNull()
    expect(p.unchanged).toBe(false)
  })

  it('저장 조회 실패면 수정안과 이전 일정을 만들지 않는다', () => {
    expect(replanProposal({ goal, rows: [row('v.core_meaning')], plans, saved: { ...saved('check', 2), error: true }, today: TODAY }).none).toBe(true)
  })

  it('T-0110 Codex 반례 — 다른 TASK 가 이미 배정된 주: weekRows 는 재확정 TASK 만 · thisWeek 는 전체(화면은 소계와 전체를 구분)', () => {
    const other = row('r.central_meaning', { planGate: null, action: { rank: 2, href: '/x', label: 'x' }, needRank: 2, quantity: { unit: '문항', planned: 2, done: 0, remaining: 2, source: 'saved' } })
    const p = replanProposal({ goal, rows: [row('v.core_meaning'), other], plans, saved: saved('check', 2), today: TODAY, revisions: [] })
    const sub = p.weekRows.reduce((a, w) => a + w.after, 0)
    expect(p.weekRows.map((w) => w.task)).toEqual(['v.core_meaning'])
    expect(p.thisWeek!.after).toBeGreaterThan(sub) // 전체에는 다른 TASK 20분이 더 있다 — 같은 「합계」로 보이면 안 된다
    expect(p.thisWeek!.current).toBe(20)
  })
})
