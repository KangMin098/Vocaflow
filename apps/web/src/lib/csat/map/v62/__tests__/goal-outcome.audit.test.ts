// apps/web/src/lib/csat/map/v62/__tests__/goal-outcome.audit.test.ts
// Independent counterexamples for a6eead261; synthetic evidence, no DB writes.
import { describe, expect, it } from 'vitest'
import { goalOutcome, type GoalOutcome, type OutcomeSession } from '../goal-outcome'
import type { GoalVersion } from '../target-goal'
import type { TaskPlan } from '../../v4/plan'

const goal: GoalVersion = { id: 7, score: 85, grade: 2, exam: 'kice9', date: '2026-11-19', createdAt: '2026-09-01T03:00:00Z' }
const session = (over: Record<string, unknown> = {}): OutcomeSession => ({ id: 'post', examId: 'k9-2026', examLabel: '9월 시험', takenAt: '2026-09-10', enteredAt: '2026-09-11T00:00:00Z', raw: 95, grade: 1, diagnosable: true, examReady: true, mode: 'live', examScope: 'kice9', firstExposure: 'unseen', ...over }) as OutcomeSession
const run = goalOutcome as (g: GoalVersion, s: readonly OutcomeSession[], p: readonly TaskPlan[], asOf: string) => GoalOutcome
const evaluate = (s: OutcomeSession[], g = goal) => run(g, s, [], '2026-10-23T00:00:00Z')

describe('P1 independent outcome audit of a6eead261', () => {
  it('retake mode cannot become independent evidence merely because it is the only exam session', () => {
    expect(evaluate([session({ mode: 'retake' })]).score.status).not.toBe('reached')
  })
  it('prior item/passage exposure outside diagnostic sessions disqualifies first-paper claims', () => {
    expect(evaluate([session({ firstExposure: 'exposed' })]).score.status).not.toBe('reached')
  })
  it('an incomplete exposure ledger is unknown, not unseen', () => {
    expect(evaluate([session({ firstExposure: 'unknown' })]).score.status).not.toBe('reached')
  })
  it('Seoul goal-day record has uncertain ordering; slicing the UTC day cannot make it a follow-up', () => {
    expect(evaluate([session({ takenAt: '2026-09-02' })], { ...goal, createdAt: '2026-09-01T15:30:00Z' }).score.status).not.toBe('reached')
  })
  it('future-dated records cannot become observed results', () => {
    expect(evaluate([session({ takenAt: '2026-12-01', enteredAt: '2026-12-01T10:00:00Z' })]).score.status).not.toBe('reached')
  })
  it('a met score with an unmet saved grade cannot automatically prescribe maintenance', () => {
    expect(evaluate([session({ grade: 3 })]).next).not.toBe('maintain')
  })
  it('same-paper repeat scores can be described separately from new independent evidence', () => {
    const o = evaluate([session({ id: 'pre', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70 }), session({ mode: 'retake', firstExposure: 'exposed' })])
    expect(o.score.status).not.toBe('reached')
    expect(o.change.status).toBe('repeat_observation')
  })
  it('exam readiness and score bounds are separate validity requirements', () => {
    expect(evaluate([session({ examReady: false })]).score.status).toBe('unreliable')
    for (const raw of [NaN, Infinity, -1, 101, 85.5]) expect(evaluate([session({ raw })]).score.status).toBe('no_score')
  })
  it('a later unrelated exam cannot replace the latest result in the saved goal scope', () => {
    const o = evaluate([session({ raw: 78, grade: 3 }), session({ id: 'unrelated', examId: 'office', examScope: 'hakpyeong', takenAt: '2026-10-10' })])
    expect(o.score.status).toBe('below')
    expect(o.followup?.id).toBe('post')
    expect(o.change.delta).toBeNull()
  })
  it('a criterion observation does not establish the target assessment or final attainment', () => {
    const o = evaluate([session()])
    expect(o.score.status).toBe('reached')
    expect(o.attainment).toEqual({ status: 'unconfirmed', reason: 'target_assessment_not_bound' })
  })
})
