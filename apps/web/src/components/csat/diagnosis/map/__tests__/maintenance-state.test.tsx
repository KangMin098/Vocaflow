// apps/web/src/components/csat/diagnosis/map/__tests__/maintenance-state.test.tsx
// T-0082 — 지금 확인 통과 + 유지(maintain_pending) 표시: 요약 행 · TASK 자세히 · Workspace 목록이 같은 사실(앞 단계 미완료 · 숙달 아님)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { taskOf } from '@/lib/csat/map/v4/definition'
import type { GoalPlanSummaryData } from '@/lib/csat/map/v62/goal-plan'
import { MAINTAIN_PASSED_LABEL } from '@/lib/csat/map/v62/maintenance-state'
import { WAIT_LABEL } from '@/lib/csat/map/v62/next-action'

import { GoalPlanSummary } from '../GoalPlanSummary'
import { BLOCKED_LABEL } from '../TaskInspector'

const task = 'r.central_meaning'
const row = (o: Record<string, unknown> = {}) => ({
  task, needRank: 1, need: 'MAINTAIN', evidence: 'resolved', basis: 'direct_check', independentItems: 4, relevance: { items: 7, pointsPerExam: 14 }, stage: 'recheck', workspace: 'ws.central-meaning',
  quantity: { unit: '문항', planned: null, done: 0, remaining: null, source: 'none' }, criterion: taskOf(task).learner_criterion, achievement: 'resolved', action: null, planGate: null, replanWhy: null, blocked: 'maintain_pending', unresolved: ['stage_locked'], ...o,
}) as GoalPlanSummaryData['rows'][number]
const html = (r: GoalPlanSummaryData['rows'][number]) => renderToStaticMarkup(<GoalPlanSummary data={{ rows: [r], required: 1, relevanceUnknown: 0, examSessions: 0, directTasks: 1, actionable: 0 }} evidence={null} goalSet onSelect={() => undefined} onOpenWs={() => undefined} />)

describe('maintain_pending 표시(T-0082)', () => {
  it('요약 행 — 「앞 단계를 마치면」 대신 지금 통과 · 유지 확인 기준 미정 · 실행 링크 없음', () => {
    const h = html(row())
    expect(h).toContain('지금 확인 통과 — 다른 날 유지 확인은 기준이 정해지지 않아 이번 학습량이 없어요')
    expect(h).not.toContain('앞 단계를 마치면 열려요')
    expect(h).not.toMatch(/href="\/csat\/(learn|item)\//)
    expect(h).not.toMatch(/숙달 완료|목표 달성했/)
  })
  it('대조 — 같은 행이 실제 단계 잠금(stage_locked)이면 기존 문구 그대로', () => {
    expect(html(row({ need: 'REPAIR', achievement: 'need_confirmed', blocked: 'stage_locked' }))).toContain('앞 단계를 마치면 열려요')
  })
  it('상단 대기 · TASK 자세히 · 요약 blocked 문구가 같은 출처', () => {
    expect(WAIT_LABEL.maintain_pending).toBe(MAINTAIN_PASSED_LABEL)
    expect(BLOCKED_LABEL.maintain_pending).toBe(MAINTAIN_PASSED_LABEL)
  })
})
