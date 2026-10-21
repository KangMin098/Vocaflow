// apps/web/src/lib/csat/map/v62/__tests__/next-action.test.ts — T-0061: 첫 화면 「지금 할 일」은 순위 · 계획 · To-Be 를 그대로 읽는다(새 판정 · 만든 수량 없음)
import { describe, expect, it } from 'vitest'

import { AUTHORED_TASKS } from '@/lib/knowledge/authored/tasks'

import type { RefItem } from '../../target'
import { asIsMap, type AxisProxyState } from '../../v4/as-is'
import type { V4View } from '../../v4/compose'
import { DOMAINS, type Domain } from '../../v4/definition'
import { allTaskPlans, workspacePlan } from '../../v4/plan'
import { toBeMap, type ConfirmLink } from '../../v4/to-be'
import { planWorkspaces } from '../../v4/workspace'
import { build } from '@/components/csat/diagnosis/map/__tests__/r5-inspector-fixture'

import { applySaved } from '../../v4/plan-commit'
import { nextActionOf, WAIT_LABEL, wsForTask } from '../next-action'
import { quantityBasis } from '../saved-plan'
import { ranksOf, type Ranks } from '../rank'

const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}?check=1`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34), A1: REF.slice(29, 31), A8: REF.slice(28, 29) }

function view(): V4View {
  const asIs = asIsMap({ asOf: '2026-09-13T00:00:00.000Z', sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts: [] })
  const toBe = toBeMap({ asIs, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [KEY]: 0 }, transferTargets: {} })
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, workspacePlan(w, asIs, toBe, plan, [])]))
  return { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, []) }
}

/** 그 묶음 계획이 저장돼 있다(최신 버전에 이 TASK 행은 없음) — 행동 종류 판정용 */
const savedWs = (ws: string) => ({ byTemplate: { [ws]: { latest: { plan: { order: [], tasks: [] } } } } }) as never

describe('nextActionOf — 지금 할 일', () => {
  const v = view()
  const r = ranksOf(v)
  const first = r.actionRank[0]

  it('활동이 있고 그 묶음 계획이 저장됨 → start: 계획의 활동 링크 · 저장 계획 수량 그대로', () => {
    expect(first).toBeTruthy()
    const ws = wsForTask(first.task, v)!
    const a = nextActionOf(v, r, savedWs(ws))!
    const p = v.taskPlans.find((x) => x.task === first.task)!
    expect(a.kind).toBe('start')
    expect(a.href).toBe(first.href)
    expect(a.ws).toBe(ws)
    // 묶음은 저장됐지만 이 TASK 행이 없으면 출처는 제안(실제 저장 행 출처는 아래 T0061-P1-1 회귀)
    expect(a.quantity).toEqual({ unit: p.quantity.unit, planned: p.quantity.planned, done: p.quantity.done, source: 'proposed' })
    expect(a.criterion).toBe(p.criterion)
  })
  it('같은 활동이라도 계획 저장 전 → plan(같은 묶음 계획 탭) · 수량은 제안 계획으로 표시', () => {
    const a = nextActionOf(v, r, { byTemplate: {} })!
    expect(a.kind).toBe('plan')
    expect(a.href).toBeNull()
    expect(a.quantity?.source).toBe('proposed')
  })
  it('지금 할 활동 없음 · 창작 세트 있는 TASK → 계획 저장 뒤 supply(자료 받기) — 재고 판정은 서버 몫', () => {
    const ws = wsForTask('e.task_demand', v)!
    const none: Ranks = { needRank: [], actionRank: [], notActionable: [{ task: 'e.task_demand' as never, reason: 'content_gap' }] }
    expect(nextActionOf(v, none, savedWs(ws))!.kind).toBe('supply')
    expect(nextActionOf(v, none, { byTemplate: {} })!.kind).toBe('plan')
  })
  it('계획 저장 전이면 단계 잠금이어도 plan(실제 첫 행동) · 정의 보류만 wait', () => {
    const one = (reason: 'canon_hold' | 'stage_locked', saved: Parameters<typeof nextActionOf>[2]) => nextActionOf(v, { needRank: [], actionRank: [], notActionable: [{ task: 'r.central_meaning' as never, reason }] }, saved)!
    expect(one('stage_locked', null).kind).toBe('plan')
    expect(one('canon_hold', null).kind).toBe('wait')
    expect(one('canon_hold', null).blocked).toBe('canon_hold')
  })
  it('계획 저장 뒤 확인 단계 잠금(확인 문항 연결 없음)인 창작 TASK → supply · 창작 세트 없으면 wait(이유)', () => {
    const saved = (task: string) => savedWs(wsForTask(task, v)!)
    const one = (task: string) => nextActionOf(v, { needRank: [], actionRank: [], notActionable: [{ task: task as never, reason: 'stage_locked' }] }, saved(task))!
    const cm = v.taskPlans.find((p) => p.task === 'r.central_meaning')!
    if (!cm.stage || cm.stage === 'check') expect(one('r.central_meaning').kind).toBe('supply')
    const plain = v.taskPlans.find((p) => !['r.central_meaning', 'e.evidence_location', 'e.task_demand'].includes(p.task) && wsForTask(p.task, v) && !AUTHORED_TASKS.includes(p.task))
    if (plain) expect(one(plain.task).kind).toBe('wait')
    expect(WAIT_LABEL.no_next_activity).toContain('몰라요')
  })
  it('관련성 미확인만 있으면 추천하지 않는다(null) · 순위가 없으면 null', () => {
    expect(nextActionOf(v, { needRank: [], actionRank: [], notActionable: [{ task: 'r.central_meaning' as never, reason: 'relevance_unknown' }] }, null)).toBeNull()
    expect(nextActionOf(v, null, null)).toBeNull()
  })
})

// T0061-P1-1 회귀 — 실제 저장 행으로(byTemplate:{} 대역이 아니라). 상단 학습량 = 계획 편집기(applySaved)와 같은 값 · 옛 단계 저장은 제안
describe('nextActionOf — 저장 계획 수량 · 단계 출처(T0061-P1-1)', () => {
  const { view: fv } = build({ goalSet: true, attempts: [], activity: [], asOfDay: 12, saved: false, fq: { status: 'installed', eligible: [] } })
  const fr = ranksOf(fv)
  const top = fr.actionRank[0]
  const ws = wsForTask(top.task, fv)!
  const p = fv.taskPlans.find((x) => x.task === top.task)!
  const row = (stage: string | null, planned: number | null) => ({ version: 2, plan: { order: [top.task], tasks: [{ task: top.task, stage, planned, available: p.quantity.available, rule: p.quantity.rule }] }, reason: 'initial' as const, note: null, restoredFrom: null, canon: 'fixture', asOf: fv.asIs.asOf, createdAt: fv.asIs.asOf })
  const of = (latest: ReturnType<typeof row>) => ({ byTemplate: { [ws]: { latest } } }) as never
  it('저장 안 함 → plan · 제안', () => {
    const a = nextActionOf(fv, fr, { byTemplate: {} })!
    expect([a.kind, a.quantity?.source]).toEqual(['plan', 'proposed'])
  })
  it('바꾸지 않은 저장 수량 → start · 저장', () => {
    const a = nextActionOf(fv, fr, of(row(p.stage, p.quantity.planned)))!
    expect([a.kind, a.quantity?.planned, a.quantity?.source]).toEqual(['start', p.quantity.planned, 'saved'])
  })
  it('학습자가 2로 줄여 저장 → 상단도 2(편집기와 같은 값) · 저장', () => {
    const r = row(p.stage, 2)
    const editor = applySaved(fv.plans[ws], r as never).tasks.find((x) => x.task === top.task)!
    const a = nextActionOf(fv, fr, of(r))!
    expect(editor.quantity.planned).toBe(2)
    expect(a.quantity?.planned).toBe(editor.quantity.planned)
    expect(a.quantity?.source).toBe('saved')
  })
  it('옛 단계로 저장된 행은 지금 단계 제안을 「저장한 계획」으로 만들지 않는다', () => {
    const a = nextActionOf(fv, fr, of(row(p.stage === 'check' ? 'repair' : 'check', 2)))!
    expect(a.quantity?.source).toBe('proposed')
    expect(a.quantity?.planned).toBe(p.quantity.planned)
  })
})

describe('nextActionOf — 저장 뒤 자료가 바뀌면 다시 확정(planDrift)', () => {
  const { view: fv } = build({ goalSet: true, attempts: [], activity: [], asOfDay: 12, saved: false, fq: { status: 'installed', eligible: [] } })
  const fr = ranksOf(fv)
  const top = fr.actionRank[0]
  const ws = wsForTask(top.task, fv)!
  const p = fv.taskPlans.find((x) => x.task === top.task)!
  const latest = (available: number | null, planned: number | null) => ({ version: 1, plan: { order: [top.task], tasks: [{ task: top.task, stage: p.stage, planned, available, rule: p.quantity.rule }] }, reason: 'initial', note: null, restoredFrom: null, canon: 'fixture', asOf: fv.asIs.asOf, createdAt: fv.asIs.asOf })
  it('자료 없을 때 저장(available·planned null) → 지금 자료가 있으면 plan · replan(옛 계획량으로 시작시키지 않음)', () => {
    const a = nextActionOf(fv, fr, { byTemplate: { [ws]: { latest: latest(null, null) } } } as never)!
    expect([a.kind, a.replan]).toEqual(['plan', true])
  })
  it('저장 당시와 자료가 같으면 start', () => {
    expect(nextActionOf(fv, fr, { byTemplate: { [ws]: { latest: latest(p.quantity.available, p.quantity.planned) } } } as never)!.kind).toBe('start')
  })
})

describe('quantityBasis — 자료 없을 때 저장한 빈 행은 계획량을 덮지 않는다(CI 39394549057)', () => {
  const { view: fv } = build({ goalSet: true, attempts: [], activity: [], asOfDay: 12, saved: false, fq: { status: 'installed', eligible: [] } })
  const fr = ranksOf(fv)
  const top = fr.actionRank[0]
  const ws = wsForTask(top.task, fv)!
  const p = fv.taskPlans.find((x) => x.task === top.task)!
  const empty = { version: 1, plan: { order: [top.task], tasks: [{ task: top.task, stage: p.stage, planned: null, available: null, rule: null }] }, reason: 'initial', note: null, restoredFrom: null, canon: 'fixture', asOf: fv.asIs.asOf, createdAt: fv.asIs.asOf }
  it('편집기 기본값(applySaved+quantityBasis) = 지금 기본 계획량 · 상단은 같은 값을 제안으로', () => {
    const editor = applySaved(fv.plans[ws], quantityBasis(empty as never)).tasks.find((x) => x.task === top.task)!
    expect(editor.quantity.planned).toBe(p.quantity.planned)
    const a = nextActionOf(fv, fr, { byTemplate: { [ws]: { latest: empty } } } as never)!
    expect([a.kind, a.replan, a.quantity?.planned, a.quantity?.source]).toEqual(['plan', true, p.quantity.planned, 'proposed'])
  })
  it('정한 값이 있는 행 · 가용량만 있던 행은 그대로', () => {
    const kept = { ...empty, plan: { ...empty.plan, tasks: [{ ...empty.plan.tasks[0], planned: 1, available: 2 }] } }
    expect(quantityBasis(kept as never)).toBe(kept)
    expect(quantityBasis(null)).toBeNull()
  })
})

// T-0072 — 저장 PLAN 의 목표 버전 ≠ 지금 목표면 단계 · 수량이 같아도 지금 목표의 확정 계획이 아니다(상단 CTA · 요약이 같은 판정)
//   Codex FINAL-MAIN-0649f8c0b goal-version 반례 3 · 정상 2 이식 + 옛 계획(목표 기록 없음) · 저장본 조회 실패 대조
describe('T-0072 목표 버전 결속', async () => {
  const { CANON_VERSION } = await import('@/lib/csat/map/v4/definition')
  const { goalPlanRows } = await import('../goal-plan')
  const { goalMismatch } = await import('../next-action')
  const task = 'r.central_meaning', ws = 'ws.central-meaning'
  function fixture(currentGoal: number | null = 11, savedGoal: number | null | undefined = 10) {
    const row = { task, name: 'core', goal: 'g', criterion: 'c', basis: 'none', evidence: 'unmeasured', need: 'CONFIRM', stage: 'check', quantity: { unit: '문항', available: 3, planned: 3, done: 0, remaining: 3 }, achievement: 'not_checked', unresolved: [], next: { href: '/csat/item/E-Q1?check=1', label: 'check' } }
    const pv = { workspace: ws, core: [task], tasks: [row], progress: { planned: 3, done: 0 } }
    const view = { taskPlans: [row], plans: { [ws]: pv }, asIs: { tasks: { [task]: { basis: 'none', status: 'unmeasured', check: null } }, sessions: [] }, toBe: { needs: [{ task, type: 'CONFIRM', relevance: { items: 3, pointsPerExam: 6 } }], relevanceUnknown: [] } }
    const ranks = { needRank: [{ rank: 1, task, need: 'CONFIRM', evidence: 'unmeasured' }], actionRank: [{ rank: 1, task, needRank: 1, href: row.next.href, label: 'check' }], notActionable: [] }
    const latest = { version: 2, canon: CANON_VERSION, ...(savedGoal === undefined ? {} : { goalVersionId: savedGoal }), reason: 'initial', createdAt: '2026-10-20T00:00:00Z', asOf: '2026-10-20T00:00:00Z', note: null, restoredFrom: null, plan: { order: [task], tasks: [{ task, stage: 'check', planned: 1, available: 3 }] } }
    const saved = { status: 'installed', goalVersionId: currentGoal, byTemplate: { [ws]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: ws, latest, history: [latest] } } }
    return { view: view as never, ranks: ranks as never, saved: saved as never }
  }

    it('반례 — 상단 행동은 같은 묶음 계획 다시 확정', () => {
      const x = fixture()
      expect(goalMismatch(ws, x.saved)).toBe(true)
      expect(nextActionOf(x.view, x.ranks, x.saved)).toMatchObject({ kind: 'plan', replan: true, replanWhy: 'goal', href: null })
    })
    it('반례 — 요약은 옛 목표 PLAN 으로 바로 실행시키지 않는다', () => {
      const r = goalPlanRows(fixture().view, fixture().ranks, fixture().saved).rows[0]
      expect({ gate: r.planGate, why: r.replanWhy, action: r.action }).toEqual({ gate: 'replan', why: 'goal', action: null })
    })
    it('정상 — 같은 목표면 저장량 · 실행 링크 그대로', () => {
      const x = fixture(10)
      expect(goalMismatch(ws, x.saved)).toBe(false)
      expect(nextActionOf(x.view, x.ranks, x.saved)?.kind).toBe('start')
      expect(goalPlanRows(x.view, x.ranks, x.saved).rows[0]).toMatchObject({ planGate: null, action: { rank: 1 }, quantity: { planned: 1, source: 'saved' } })
    })
    it('옛 계획(저장 당시 목표 기록 없음)은 지금 목표가 있으면 지금 목표 확정으로 올리지 않는다 · 둘 다 없으면 같음', () => {
      expect(goalMismatch(ws, fixture(11, undefined).saved)).toBe(true)
      expect(goalMismatch(ws, fixture(11, null).saved)).toBe(true)
      expect(goalMismatch(ws, fixture(null, null).saved)).toBe(false)
    })
    it('저장본 조회 실패 · 저장 없음은 목표 판정을 하지 않는다(추측 없음)', () => {
      expect(goalMismatch(ws, { status: 'installed', error: true, goalVersionId: 11, byTemplate: {} } as never)).toBe(false)
      expect(goalMismatch(ws, { status: 'installed', goalVersionId: 11, byTemplate: {} } as never)).toBe(false)
    })
})
