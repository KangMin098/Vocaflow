// apps/web/src/lib/csat/map/v62/__tests__/goal-plan.test.ts
// T-0070 — 목표 요약 행: 계획량은 PLAN 편집기와 같은 값(같은 단계 저장 = 저장 · 아니면 제안) · 조회 불가 ≠ 제안 · 자료 없음 null 유지 ·
// NeedRank(행 순서)와 ActionRank(지금 할 순서) 분리 · 직접 근거와 시험 관찰 구분 · 새 숫자 없음
import { describe, expect, it } from 'vitest'

import { goalPlanRows } from '../goal-plan'

const tp = (task: string, o: Record<string, unknown> = {}) => ({
  task, name: task, goal: 'g', criterion: `${task} 조건`, evidence: 'unmeasured', basis: 'none', relevance: null, need: 'CONFIRM', priority: 1, stage: 'check', workspaces: ['ws.a'],
  next: null, quantity: { unit: '문항', available: 2, planned: 2, done: 0, remaining: 2 }, achievement: 'not_checked', unresolved: [], ...o,
})
function view(tasks: ReturnType<typeof tp>[]) {
  return {
    asIs: { sessions: [], tasks: Object.fromEntries(tasks.map((t) => [t.task, { basis: t.basis, status: t.evidence, check: t.basis === 'direct_check' ? { independentItems: 2 } : null }])) },
    toBe: { needs: tasks.map((t) => ({ task: t.task, relevance: { items: 3, pointsPerExam: 6 } })), relevanceUnknown: [] },
    taskPlans: tasks,
    plans: { 'ws.a': { workspace: 'ws.a', core: [tasks[0].task], tasks, progress: null } },
  } as never
}
const ranks = (order: string[], action: string[], blocked: Record<string, string> = {}) => ({
  needRank: order.map((task, i) => ({ rank: i + 1, task, need: 'CONFIRM', evidence: 'unmeasured', confirmed: false })),
  actionRank: action.map((task, i) => ({ rank: i + 1, task, href: `/csat/learn/${task}`, label: task, needRank: order.indexOf(task) + 1 })),
  notActionable: Object.entries(blocked).map(([task, reason]) => ({ task, reason })),
}) as never
const saved = (tasks: { task: string; stage: string; planned: number | null; available: number | null }[]) => ({
  status: 'installed', goalVersionId: 1, byTemplate: { 'ws.a': { latest: { version: 3, plan: { order: tasks.map((t) => t.task), tasks }, canon: 'x' } } },
}) as never

describe('goalPlanRows', () => {
  it('P1-1 — 상단 CTA 와 같은 관문: 저장 계획 없음 = plan · 저장 뒤 자료 변화 = replan · 그때는 실행 링크 없음', () => {
    const v = view([tp('a.one')])
    expect(goalPlanRows(v, ranks(['a.one'], ['a.one']), { status: 'installed', byTemplate: {}, goalVersionId: 1 } as never).rows[0]).toMatchObject({ action: null, planGate: 'plan', blocked: null })
    expect(goalPlanRows(v, ranks(['a.one'], ['a.one']), saved([{ task: 'a.one', stage: 'check', planned: 1, available: 1 }])).rows[0]).toMatchObject({ action: null, planGate: 'replan' })
    expect(goalPlanRows(v, ranks(['a.one'], ['a.one']), saved([{ task: 'a.one', stage: 'check', planned: 1, available: 2 }])).rows[0]).toMatchObject({ planGate: null, action: { rank: 1 } })
  })
  it('P1-2 — 관련성 미확인은 목표 필요 수에 넣지 않는다(행은 지우지 않음)', () => {
    const r = { needRank: [{ rank: 1, task: 'a.one', need: 'CONFIRM' }, { rank: 2, task: 'b.two', need: 'RELEVANCE_UNKNOWN' }], actionRank: [], notActionable: [{ task: 'b.two', reason: 'relevance_unknown' }] } as never
    const d = goalPlanRows(view([tp('a.one'), tp('b.two')]), r, null)
    expect([d.rows.length, d.required, d.relevanceUnknown]).toEqual([2, 1, 1])
  })
  it('행 순서 = NeedRank · 실행 번호 = ActionRank(서로 다를 수 있다) · 못 하는 이유는 따로', () => {
    const v = view([tp('a.one'), tp('b.two')])
    const d = goalPlanRows(v, ranks(['a.one', 'b.two'], ['b.two'], { 'a.one': 'material_needed' }), saved([{ task: 'a.one', stage: 'check', planned: 2, available: 2 }, { task: 'b.two', stage: 'check', planned: 2, available: 2 }]))
    expect(d.rows.map((r) => [r.task, r.needRank, r.action?.rank ?? null, r.blocked])).toEqual([['a.one', 1, null, 'material_needed'], ['b.two', 2, 1, null]])
    expect(d.actionable).toBe(1)
  })
  it('같은 단계로 저장한 계획량 = 저장 · 다른 단계 저장 행 = 제안(지금 값)', () => {
    const v = view([tp('a.one'), tp('b.two', { stage: 'repair' })])
    const d = goalPlanRows(v, ranks(['a.one', 'b.two'], []), saved([{ task: 'a.one', stage: 'check', planned: 1, available: 2 }, { task: 'b.two', stage: 'check', planned: 1, available: 2 }]))
    expect(d.rows[0].quantity).toMatchObject({ planned: 1, remaining: 1, source: 'saved' })
    expect(d.rows[1].quantity).toMatchObject({ planned: 2, source: 'proposed' })
  })
  it('저장 계획 조회 실패 = 알 수 없음(제안값으로 대신하지 않음)', () => {
    const d = goalPlanRows(view([tp('a.one')]), ranks(['a.one'], []), { status: 'installed', error: true, byTemplate: {}, goalVersionId: null } as never)
    expect(d.rows[0].quantity).toMatchObject({ planned: null, remaining: null, source: 'unknown' })
  })
  it('자료가 없으면 계획량 null · 이유 그대로 · 학습 요구 행은 지우지 않는다', () => {
    const d = goalPlanRows(view([tp('a.one', { quantity: { unit: '지문', available: null, planned: null, done: 0, remaining: null }, unresolved: ['material_needed', 'needs_direct_check'], stage: 'transfer' })]), ranks(['a.one'], []), null)
    expect(d.rows).toHaveLength(1)
    expect(d.rows[0].quantity).toMatchObject({ planned: null, source: 'none', unit: '지문' })
    expect(d.rows[0].unresolved).toEqual(['material_needed'])
  })
  it('근거 — 직접 확인과 시험 관찰을 나눠 세고 · 독립 문항 수는 직접 확인에만', () => {
    const d = goalPlanRows(view([tp('a.one', { basis: 'direct_check', evidence: 'checking' }), tp('b.two', { basis: 'axis_proxy', evidence: 'observed' })]), ranks(['a.one', 'b.two'], []), null)
    expect(d.directTasks).toBe(1)
    expect(d.examSessions).toBe(0)
    expect(d.rows.map((r) => [r.basis, r.independentItems])).toEqual([['direct_check', 2], ['axis_proxy', null]])
  })
  it('목표 관련도는 사실(문항 · 배점)만 · 도달 조건은 코드북 그대로', () => {
    const r = goalPlanRows(view([tp('a.one')]), ranks(['a.one'], []), null).rows[0]
    expect(r.relevance).toEqual({ items: 3, pointsPerExam: 6 })
    expect(r.criterion).toBe('a.one 조건')
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(['totalNeeded', 'eta', 'scoreGain', 'mastery']))
  })
})
