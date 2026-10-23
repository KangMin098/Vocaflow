// apps/web/src/lib/csat/map/v62/__tests__/goal-schedule.test.ts
import { describe, expect, it } from 'vitest'
import { parseGoalBudget, sameBudget, type GoalBudget } from '../goal-budget'
import { budgetUsage, goalSchedule, scheduleChanges } from '../goal-schedule'
import { parseGoalInput, type GoalVersion } from '../target-goal'
import type { GoalPlanRow } from '../goal-plan'

export const BUDGET: GoalBudget = { weeklyMinutes: 120, dailyMinutes: [20, 20, 20, 20, 20, 20, 0], minutesPerUnit: 10, priorities: [] }
export const GOAL: GoalVersion = { id: 1, exam: 'suneung', score: 80, grade: null, date: '2026-11-01', createdAt: '2026-10-23T00:00:00Z', budget: BUDGET }
export function row(overrides: Partial<GoalPlanRow> = {}): GoalPlanRow {
  return { task: 'r.central_meaning', needRank: 1, need: 'CONFIRM', evidence: 'unmeasured', basis: 'none', independentItems: null, relevance: { items: 2, pointsPerExam: 4 }, stage: 'check', workspace: 'ws.central-meaning', quantity: { unit: '문항', planned: 4, remaining: 4, done: 0, source: 'saved' }, criterion: '근거를 들어 설명한다', achievement: 'not_checked', action: { rank: 1, href: '/csat/learn/authored-central-meaning?phase=check', label: '혼자 확인하기' }, planGate: null, replanWhy: null, blocked: null, unresolved: [], ...overrides }
}

describe('goal budget validation', () => {
  it.each([NaN, Infinity, -1, 0, 1.5, 10081, '120'])('rejects invalid weekly cap %s', weeklyMinutes => {
    expect(parseGoalBudget({ ...BUDGET, weeklyMinutes }).ok).toBe(false)
  })
  it.each([[10, 20], [0, 0, 0, 0, 0, 0, -1], [100, 100, 0, 0, 0, 0, 0]])('rejects invalid daily caps %j', (...dailyMinutes) => {
    expect(parseGoalBudget({ ...BUDGET, dailyMinutes }).ok).toBe(false)
  })
  it('rejects unknown, held, duplicated priorities and fields', () => {
    for (const priorities of [['invented'], ['r.central_meaning', 'r.central_meaning']]) expect(parseGoalBudget({ ...BUDGET, priorities }).ok).toBe(false)
    expect(parseGoalBudget({ ...BUDGET, autoConfirm: true }).ok).toBe(false)
  })
  it('requires exam/date with a budget and never converts grade into a score', () => {
    expect(parseGoalInput({ target: 80, exam: 'suneung', date: '2026-11-01', budget: BUDGET, expectedGoalVersion: null }, '2026-10-23').ok).toBe(true)
    expect(parseGoalInput({ target: 80, exam: 'suneung', date: '2026-11-01', budget: BUDGET }, '2026-10-23').ok).toBe(false)
    expect(parseGoalInput({ target: 80, budget: BUDGET }, '2026-10-23').ok).toBe(false)
    expect(parseGoalInput({ grade: 2, exam: 'suneung', date: '2026-11-01', budget: BUDGET }, '2026-10-23').ok).toBe(false)
    expect(parseGoalInput({ target: 80, exam: 'suneung', date: '2040-11-01', budget: BUDGET }, '2026-10-23').ok).toBe(false)
  })
  it('compares normalized budgets structurally, independent of object key order', () => {
    expect(sameBudget(BUDGET, { priorities: [], minutesPerUnit: 10, dailyMinutes: [...BUDGET.dailyMinutes!], weeklyMinutes: 120 })).toBe(true)
    expect(sameBudget(BUDGET, { ...BUDGET, weeklyMinutes: 60 })).toBe(false)
  })
})

describe('goal calendar allocation: synthetic A/B/C', () => {
  it('A: independent failure returns the repair stage; no unrelated TASK is promoted', () => {
    const original = [row(), row({ task: 'e.option_correspondence', needRank: 2, workspace: 'ws.option-match' })]
    const copy = structuredClone(original)
    const before = goalSchedule(GOAL, original, '2026-10-23')
    const repaired = [row({ stage: 'repair', need: 'REPAIR', evidence: 'verified_need', quantity: { planned: 1, remaining: 1, done: 0, unit: '문항', source: 'saved' } }), original[1]]
    const after = goalSchedule(GOAL, repaired, '2026-10-23')
    expect(after.allocations[0].stage).toBe('repair')
    expect(after.allocations.filter(a => a.task === original[1].task).reduce((n, a) => n + a.amount, 0)).toBe(4)
    expect(scheduleChanges(before, after, false)).toEqual([{ task: original[0].task, before: 4, after: 1, reason: 'evidence_or_content' }])
    expect(original).toEqual(copy)
  })
  it('B: no exam record remains unmeasured, yet an actual independent link can be scheduled', () => {
    const r = row()
    const s = goalSchedule(GOAL, [r], '2026-10-23')
    expect(s.allocations[0]).toMatchObject({ evidence: 'unmeasured', stage: 'check', date: '2026-10-23', amount: 2 })
    expect(r.basis).toBe('none')
    const noContent = goalSchedule(GOAL, [row({ action: null, quantity: { ...r.quantity, remaining: null, planned: null } })], '2026-10-23')
    expect(noContent.unassigned[0]).toMatchObject({ amount: null, reason: 'content' })
    expect(noContent.allocations).toEqual([])
  })
  it('C: less time/new goal yields less work; stale PLAN must be reconfirmed and old inputs stay immutable', () => {
    const old = structuredClone(GOAL)
    const before = goalSchedule(GOAL, [row()], '2026-10-23')
    const newGoal = { ...GOAL, id: 2, date: '2026-10-23', budget: { ...BUDGET, weeklyMinutes: 10, dailyMinutes: [0, 0, 0, 0, 10, 0, 0] } }
    const after = goalSchedule(newGoal, [row()], '2026-10-23')
    expect(after.allocations[0].amount).toBe(1)
    expect(after.unassigned[0]).toMatchObject({ amount: 3, reason: 'time' })
    expect(scheduleChanges(before, after, true)[0].reason).toBe('goal')
    expect(goalSchedule(newGoal, [row({ action: null, planGate: 'replan' })], '2026-10-23').unassigned[0].reason).toBe('plan')
    expect(GOAL).toEqual(old)
  })
  it('never guesses quantities for missing content, unknown relevance, ledger failures or maintenance', () => {
    const s = goalSchedule(GOAL, [row({ need: 'RELEVANCE_UNKNOWN' }), row({ task: 'e.option_correspondence', quantity: { unit: '문항', planned: null, remaining: null, done: 0, source: 'unknown' } }), row({ task: 'r.inference', blocked: 'maintain_pending' })], '2026-10-23')
    expect(s.allocations).toEqual([])
    expect(s.unassigned.map(a => a.reason)).toEqual(['relevance', 'unknown', 'maintenance'])
    expect(s.unassigned.every(a => a.amount === null)).toBe(true)
  })
  it('uses whole units with automatic daily allocation, including small weekly budgets', () => {
    const s = goalSchedule({ ...GOAL, budget: { ...BUDGET, weeklyMinutes: 60, dailyMinutes: null } }, [row()], '2026-10-26')
    expect(s.allocations.reduce((n, a) => n + a.amount, 0)).toBe(4)
  })
  it('reserves recorded attempts on refresh, preventing an already completed unit from replenishing today’s budget', () => {
    const event = { attemptId: 'one', taskKey: 'authored-central-meaning', itemRef: 'authored:one', phase: 'practice', isCorrect: false, answeredAt: '2026-10-22T15:10:00Z', receivedAt: '2026-10-22T15:10:02Z', synthetic: false }
    const usage = budgetUsage(BUDGET, [event, event, { ...event, attemptId: 'synthetic', synthetic: true }, { ...event, attemptId: 'future', receivedAt: '2026-10-24T00:00:00Z' }], '2026-10-23T01:00:00Z')
    expect(usage).toEqual([{ date: '2026-10-23', minutes: 10 }])
    const after = goalSchedule(GOAL, [row({ quantity: { planned: 4, remaining: 3, done: 1, source: 'saved', unit: '문항' } })], '2026-10-23', usage)
    expect(after.allocations.filter(a => a.date === '2026-10-23').reduce((n, a) => n + a.minutes, 0)).toBe(10)
    expect(after.weeks[0].reserved).toBe(10)
    expect(after.weeks.every(w => w.minutes + w.reserved <= BUDGET.weeklyMinutes)).toBe(true)
  })
  it('limits every date and calendar week over a range of budgets and partial-week deadlines', () => {
    for (const weeklyMinutes of [1, 9, 10, 60, 121, 500, 10080]) {
      const s = goalSchedule({ ...GOAL, budget: { ...BUDGET, weeklyMinutes, dailyMinutes: null } }, [row({ quantity: { unit: '지문', planned: 999, remaining: 999, done: 0, source: 'saved' } })], '2026-10-23')
      expect(s.weeks.every(w => w.minutes <= w.capacity && w.capacity <= weeklyMinutes)).toBe(true)
      expect(s.allocations.every(a => a.date <= GOAL.date! && a.date >= '2026-10-23' && a.minutes <= 1440)).toBe(true)
      expect(s.allocations.reduce((n, a) => n + a.amount, 0) + s.unassigned.reduce((n, a) => n + (a.amount ?? 0), 0)).toBe(999)
    }
  })
  it('expired and invalid dates are explicit; no invented link or future evidence', () => {
    expect(goalSchedule(GOAL, [row()], '2026-11-02')).toMatchObject({ status: 'expired', allocations: [], unassigned: [{ reason: 'deadline', amount: 4, task: 'r.central_meaning', unit: '문항' }] })
    expect(() => goalSchedule(GOAL, [], '2026-02-30')).toThrow()
    expect(goalSchedule({ ...GOAL, budget: undefined }, [], '2026-10-23').status).toBe('missing_budget')
  })
})
