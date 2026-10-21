// apps/web/src/components/csat/diagnosis/map/__tests__/goal-plan-summary.test.tsx
// T-0070 — 목표 요약(접기): 처음엔 한 줄 · 행 = NeedRank 순서 · 지금 할 수 있는 활동만 실행 링크 · 막힌 이유 · 같은 Workspace 계획 · 자료 버튼 · 점수 · 기간 예측 없음
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { GoalPlanSummaryData } from '@/lib/csat/map/v62/goal-plan'

import { GoalPlanSummary } from '../GoalPlanSummary'

const row = (o: Partial<GoalPlanSummaryData['rows'][number]>) => ({
  task: 'r.inference', needRank: 1, need: 'CONFIRM', evidence: 'unmeasured', basis: 'none', independentItems: null, relevance: { items: 3, pointsPerExam: 6 },
  stage: 'check', workspace: 'ws.inference', quantity: { unit: '문항', planned: 2, done: 0, remaining: 2, source: 'proposed' }, criterion: '근거를 대며 추론한다',
  achievement: 'not_checked', action: null, blocked: null, unresolved: [], ...o,
}) as GoalPlanSummaryData['rows'][number]
const data: GoalPlanSummaryData = {
  rows: [
    row({ task: 'r.inference', blocked: 'material_needed', quantity: { unit: '지문', planned: null, done: 0, remaining: null, source: 'none' }, unresolved: ['material_needed'], stage: 'transfer' }),
    row({ task: 'r.relation', needRank: 2, workspace: 'ws.cohesion', action: { rank: 1, href: '/csat/learn/rel-ind-1?d=x', label: '혼자 확인' }, quantity: { unit: '문항', planned: 1, done: 0, remaining: 1, source: 'saved' }, basis: 'direct_check', evidence: 'checking', independentItems: 1 }),
  ],
  examSessions: 0, directTasks: 1, actionable: 1,
}
const html = renderToStaticMarkup(<GoalPlanSummary data={data} goalSet onSelect={() => undefined} onOpenWs={() => undefined} />)

describe('GoalPlanSummary', () => {
  it('접힌 details · 요약 한 줄에 필요 TASK 수 · 지금 할 수 있는 수 · 시험 기록과 직접 근거를 따로', () => {
    expect(html).toMatch(/^<details[^>]*data-testid="goal-plan"/)
    expect(html).not.toContain('open=""')
    expect(html).toContain('목표에 필요한 TASK 2개')
    expect(html).toContain('지금 할 수 있는 것 1개')
    expect(html).toContain('시험 기록 0회 · 직접 확인 근거가 있는 TASK 1개')
  })
  it('행 순서 = NeedRank · 실행 링크는 ActionRank 번호로 · 막힌 행은 이유만', () => {
    expect(html.indexOf('data-task="r.inference"')).toBeLessThan(html.indexOf('data-task="r.relation"'))
    expect(html).toContain('href="/csat/learn/rel-ind-1?d=x&amp;from=map&amp;map_task=r.relation&amp;ws=ws.cohesion"')
    expect(html).toContain('지금 할 수 있어요 1')
    expect(html).toContain('새 자료가 필요해요')
    expect((html.match(/data-testid="goal-plan-do"/g) ?? []).length).toBe(1)
  })
  it('이번 학습량 — 저장/제안 구분 · 자료 없음은 이유 · 같은 Workspace 계획 · 자료 버튼', () => {
    expect(html).toContain('저장한 계획 1문항 · 수행 0 · 남음 1')
    expect(html).toContain('이 단계 새 자료가 필요해요')
    expect((html.match(/data-testid="goal-plan-open-plan"/g) ?? []).length).toBe(2)
  })
  it('점수 · 기간 예측 · 숙달률 없음 · 조건 통과 ≠ 목표 점수', () => {
    expect(html).toContain('목표 점수 달성은 아니에요')
    expect(html).not.toMatch(/점 오|점 상승|주 뒤|일 뒤|숙달률|%/)
  })
  it('목표 없음 · 요구 없음이면 그리지 않는다', () => {
    expect(renderToStaticMarkup(<GoalPlanSummary data={data} goalSet={false} onSelect={() => undefined} onOpenWs={() => undefined} />)).toBe('')
    expect(renderToStaticMarkup(<GoalPlanSummary data={{ ...data, rows: [] }} goalSet onSelect={() => undefined} onOpenWs={() => undefined} />)).toBe('')
  })
})
