// apps/web/src/components/csat/diagnosis/map/__tests__/criterion-scope.test.tsx
// T-0074 — 지금 정책 확인 통과 ≠ 정본 도달 조건 전체: 요약 행이 기존 근거 칩으로 「시간 지나 다시 확인은 아직 근거 없음」을 함께 보인다.
//   Codex FINAL-MAIN-29b428c28 criterion-scope 반례 1 · 대조 2 이식 + 범위 없음/원장 불명확/직접 근거 없는 행 대조
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { taskOf } from '@/lib/csat/map/v4/definition'
import type { GoalPlanSummaryData } from '@/lib/csat/map/v62/goal-plan'

import { GoalPlanSummary } from '../GoalPlanSummary'

const task = 'r.central_meaning'
const row = (o: Record<string, unknown> = {}) => ({
  task, needRank: 1, need: 'MAINTAIN', evidence: 'resolved', basis: 'direct_check', independentItems: 4, relevance: { items: 7, pointsPerExam: 15 }, stage: null, workspace: 'ws.central-meaning',
  quantity: { unit: '문항', planned: null, done: 0, remaining: null, source: 'none' }, criterion: taskOf(task).learner_criterion, achievement: 'resolved', action: null, planGate: null, replanWhy: null, blocked: 'material_needed', unresolved: ['material_needed'], ...o,
}) as GoalPlanSummaryData['rows'][number]
const ev = (o: Record<string, unknown> = {}) => ({
  task, taskKey: null, currentCheck: { status: 'passed_current_policy', independentItems: 4, policy: 'existing' }, instructionPath: { repair: 'succeeded', transferDone: 2, transferPlanned: 2 },
  newPassageTransfer: { status: 'experienced', passages: 2 }, delayedRetention: { status: 'NOT_ESTABLISHED', reason: 'no_approved_interval_or_instrument' }, learningEffect: 'NOT_EVALUATED', ledger: 'complete', attempts: [], sharedPassageGroups: [], scope: null, ...o,
})
const render = (rows: GoalPlanSummaryData['rows'], evidence: unknown) => renderToStaticMarkup(<GoalPlanSummary data={{ rows, required: rows.length, relevanceUnknown: 0, examSessions: 0, directTasks: 1, actionable: 0 }} evidence={evidence as never} goalSet onSelect={() => undefined} onOpenWs={() => undefined} />)

describe('지금 확인한 범위 vs 도달 조건', () => {
  it('반례 — 지금 정책 통과 옆에 시간 지나 다시 확인 · 아직 근거 없음(기존 칩) + 다른 날 유지 미확인 안내', () => {
    const h = render([row()], { [task]: ev() })
    expect(h).toContain('data-testid="goal-plan-evidence"')
    expect(h).toContain('data-delay="NOT_ESTABLISHED"')
    expect(h).toContain('시간 지나 다시 확인 · 아직 근거 없음')
    expect(h).toContain('data-testid="goal-plan-scope-note"')
  })
  it('대조 — 정본 도달 조건 원문 보존 · 목표 점수 · 학습 효과 · 장기 유지 성공을 만들지 않는다', () => {
    const h = render([row()], { [task]: ev() })
    expect(h).toContain(taskOf(task).learner_criterion)
    expect(h).toContain('목표 점수 달성은 아니에요')
    expect(h).not.toMatch(/숙달 완료|학습 효과 입증|장기 유지 통과/)
  })
  it('범위(view.evidence) 없음 = 확인 불가(0개 · 완료로 대체하지 않음)', () => {
    const h = render([row()], null)
    expect(h).toContain('data-testid="goal-plan-scope-unknown"')
    expect(h).toContain('확인한 것이 0개라는 뜻은 아니에요')
    expect(h).not.toContain('goal-plan-evidence')
  })
  it('원장 불명확 = 범위 확인 불가 안내 · 직접 근거가 없는 행에는 칩 · 안내를 반복하지 않는다', () => {
    expect(render([row()], { [task]: ev({ ledger: 'unknown' }) })).toContain('수행 기록을 다 읽지 못해 범위를 확인할 수 없어요')
    const h = render([row({ basis: 'none', evidence: 'unmeasured', achievement: 'not_checked' })], { [task]: ev() })
    expect(h).not.toContain('goal-plan-evidence')
    expect(h).not.toContain('goal-plan-scope-unknown')
  })
  it('통과 전(확인 중)에는 통과 안내 없이 칩만', () => {
    const h = render([row({ evidence: 'checking', achievement: 'checking' })], { [task]: ev({ currentCheck: { status: 'checking', independentItems: 1, policy: 'existing' } }) })
    expect(h).toContain('goal-plan-evidence')
    expect(h).not.toContain('goal-plan-scope-note')
  })
})
