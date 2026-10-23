// apps/web/src/lib/csat/map/v62/__tests__/goal-outcome.test.ts
import { describe, expect, it } from 'vitest'

import type { TaskPlan } from '../../v4/plan'
import { examScopeOf, goalOutcome as outcome, type OutcomeSession } from '../goal-outcome'
import type { GoalVersion } from '../target-goal'

const goal: GoalVersion = { id: 7, score: 85, grade: 2, exam: 'kice9', date: '2026-11-19', createdAt: '2026-09-01T03:00:00Z' }
const goalOutcome = (g: GoalVersion, sessions: readonly OutcomeSession[], plans: readonly TaskPlan[]) => outcome(g, sessions, plans, '2026-10-23T00:00:00Z')

const s = (id: string, examId: string, takenAt: string, raw: number | null, over: Partial<OutcomeSession> = {}): OutcomeSession =>
  ({ id, examId, examLabel: examId, takenAt, enteredAt: `${takenAt}T12:00:00Z`, raw, grade: null, diagnosable: true, examReady: true, mode: 'live', firstExposure: 'unseen', examScope: 'kice9', ...over })

const plan = (task: string, over: Partial<TaskPlan>) => ({ task, need: 'CONFIRM', achievement: 'not_checked', ...over }) as TaskPlan

describe('examScopeOf', () => {
  it('목표 시험 범위와 같은 규칙', () => {
    expect(examScopeOf({ organizer: 'kice', kind: 'suneung', month: 11 })).toBe('suneung')
    expect(examScopeOf({ organizer: 'kice', kind: 'mock', month: 6 })).toBe('kice6')
    expect(examScopeOf({ organizer: 'edu_office', kind: 'mock', month: 3 })).toBe('hakpyeong')
    expect(examScopeOf({ organizer: 'kice', kind: 'mock', month: 4 })).toBeNull()
  })
})

describe('goalOutcome — 목표 대비 판정', () => {
  it('시험 기록이 없는 학습자 — 미확인 · 다음은 새 시험 기록', () => {
    const o = goalOutcome(goal, [], [])
    expect(o.score.status).toBe('no_followup')
    expect(o.change.status).toBe('no_baseline')
    expect(o.next).toBe('take_followup_exam')
  })

  it('목표 뒤 새 9월 기록이 목표보다 낮으면 below · 계획 재확정', () => {
    const o = goalOutcome(goal, [s('a', 'k9-2025', '2026-08-20', 70), s('b', 'k9-2026', '2026-09-10', 78, { grade: 3 })], [])
    expect(o.score).toEqual({ status: 'below', gap: -7 })
    expect(o.grade.status).toBe('below')
    expect(o.change.status).toBe('different_paper') // 다른 시험지 — 차이를 만들지 않는다
    expect(o.next).toBe('replan_new_exam')
  })

  it('목표 이상이면 reached · 같은 시험지 이전 기록이 없으면 변화는 비교 안 함', () => {
    const o = goalOutcome(goal, [s('b', 'k9-2026', '2026-09-10', 88, { grade: 2 })], [])
    expect(o.score).toEqual({ status: 'reached', gap: 3 })
    expect(o.grade.status).toBe('reached')
    expect(o.next).toBe('review_goal_evidence')
  })

  it('이미 본 시험지 재풀이는 새 평가가 아니다', () => {
    const o = goalOutcome(goal, [s('a', 'k9-2025', '2026-08-20', 70), s('b', 'k9-2025', '2026-09-10', 95)], [])
    expect(o.score.status).toBe('repeated_paper')
    expect(o.followup).toBeNull()
  })

  it('다른 종류 시험은 직접 비교 불가 · 신뢰 미통과 기록은 판정에 쓰지 않는다', () => {
    expect(goalOutcome(goal, [s('b', 'hp-2026-10', '2026-10-10', 90, { examScope: 'hakpyeong' })], []).score.status).toBe('different_exam')
    expect(goalOutcome(goal, [s('b', 'k9-2026', '2026-09-10', 90, { diagnosable: false })], []).score.status).toBe('unreliable')
  })

  it('목표 시험이 없으면 비교 척도를 정하지 않는다', () => {
    const o = goalOutcome({ ...goal, exam: null }, [s('b', 'k9-2026', '2026-09-10', 90)], [])
    expect(o.score.status).toBe('no_goal_exam')
    expect(o.next).toBe('set_goal_exam')
  })

  it('TASK 활동을 모두 해소해도 시험 기록이 없으면 목표 도달이 아니다', () => {
    const o = goalOutcome(goal, [], [plan('R1', { achievement: 'resolved' }), plan('R2', { achievement: 'resolved' })])
    expect(o.activity).toEqual({ needs: 2, resolved: 2 })
    expect(o.score.status).toBe('no_followup')
  })

  it('목표 등급이 없으면 등급 판정 없음 · 점수로 등급을 만들지 않는다', () => {
    const o = goalOutcome({ ...goal, grade: null }, [s('b', 'k9-2026', '2026-09-10', 99)], [])
    expect(o.grade.status).toBe('no_target')
    expect(goalOutcome(goal, [s('b', 'k9-2026', '2026-09-10', 99)], []).grade.status).toBe('no_record_grade')
  })
})
