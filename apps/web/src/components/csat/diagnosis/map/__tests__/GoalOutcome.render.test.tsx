// apps/web/src/components/csat/diagnosis/map/__tests__/GoalOutcome.render.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { AsIsSession } from '@/lib/csat/map/v4/as-is'
import type { TaskPlan } from '@/lib/csat/map/v4/plan'
import type { GoalVersion } from '@/lib/csat/map/v62/target-goal'
import { goalOutcome } from '@/lib/csat/map/v62/goal-outcome'

import { GoalOutcome } from '../GoalOutcome'

const goal: GoalVersion = { id: 3, score: 85, grade: null, exam: 'kice9', date: '2026-11-19', createdAt: '2026-09-01T03:00:00Z' }
const session = (examId: string, takenAt: string, raw: number): AsIsSession =>
  ({ id: examId, examId, examLabel: `${examId} 회차`, takenAt, enteredAt: `${takenAt}T12:00:00Z`, raw, grade: null, diagnosable: true, examReady: true, examScope: 'kice9', mode: 'live', firstExposure: 'unseen' })
const evaluate = (sessions: AsIsSession[], plans: TaskPlan[] = []) => goalOutcome(goal, sessions.map(s => ({ ...s, examScope: s.examScope ?? null })), plans, '2026-10-23T00:00:00Z')

describe('GoalOutcome', () => {
  it('목표 뒤 새 기록 — 점수 차와 다른 시험지 표시 · 활동은 도달 근거 아님', () => {
    const html = renderToStaticMarkup(<GoalOutcome outcome={evaluate([session('k9-2025', '2026-08-20', 70), session('k9-2026', '2026-09-10', 78)], [{ task: 'R1', need: 'CONFIRM', achievement: 'resolved' } as TaskPlan])} past={false} />)
    expect(html).toContain('data-score="below"')
    expect(html).toContain('목표 85점 (-7점)')
    expect(html).toContain('다른 시험지라 점수 차이를 계산하지 않아요')
    expect(html).toContain('목표 점수 도달 근거는 아니에요')
    expect(html).not.toMatch(/\d+%/)
    expect(html).toContain('이 카드로는 최종 목표 달성을 판정하지 않아요(미확인)')
  })

  it('기록이 없으면 미확인 · 지난 기준 화면과 목표 없음은 그리지 않는다', () => {
    expect(renderToStaticMarkup(<GoalOutcome outcome={evaluate([])} past={false} />)).toContain('data-score="no_followup"')
    expect(renderToStaticMarkup(<GoalOutcome outcome={evaluate([])} past />)).toBe('')
    expect(renderToStaticMarkup(<GoalOutcome outcome={null} past={false} />)).toBe('')
  })
})
