// apps/web/src/components/csat/diagnosis/map/__tests__/GoalOutcome.render.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { AsIsSession } from '@/lib/csat/map/v4/as-is'
import type { TaskPlan } from '@/lib/csat/map/v4/plan'
import type { GoalVersion } from '@/lib/csat/map/v62/target-goal'

import { GoalOutcome } from '../GoalOutcome'

const goal: GoalVersion = { id: 3, score: 85, grade: null, exam: 'kice9', date: '2026-11-19', createdAt: '2026-09-01T03:00:00Z' }
const session = (examId: string, takenAt: string, raw: number): AsIsSession =>
  ({ id: examId, examId, examLabel: `${examId} 회차`, takenAt, enteredAt: takenAt, raw, grade: null, diagnosable: true, examReady: true, examScope: 'kice9' })

describe('GoalOutcome', () => {
  it('목표 뒤 새 기록 — 점수 차와 다른 시험지 표시 · 활동은 도달 근거 아님', () => {
    const html = renderToStaticMarkup(<GoalOutcome goal={goal} sessions={[session('k9-2025', '2026-08-20', 70), session('k9-2026', '2026-09-10', 78)]} plans={[{ task: 'R1', need: 'CONFIRM', achievement: 'resolved' } as TaskPlan]} past={false} />)
    expect(html).toContain('data-score="below"')
    expect(html).toContain('목표 85점 (-7점)')
    expect(html).toContain('다른 시험지라 점수 차이를 계산하지 않아요')
    expect(html).toContain('목표 점수 도달 근거는 아니에요')
    expect(html).not.toMatch(/\d+%/)
  })

  it('기록이 없으면 미확인 · 지난 기준 화면과 목표 없음은 그리지 않는다', () => {
    expect(renderToStaticMarkup(<GoalOutcome goal={goal} sessions={[]} plans={[]} past={false} />)).toContain('data-score="no_followup"')
    expect(renderToStaticMarkup(<GoalOutcome goal={goal} sessions={[]} plans={[]} past />)).toBe('')
    expect(renderToStaticMarkup(<GoalOutcome goal={null} sessions={[]} plans={[]} past={false} />)).toBe('')
  })
})
