// apps/web/src/lib/csat/map/v62/__tests__/next-action.test.ts — T-0061: 첫 화면 「지금 할 일」은 순위 · 계획 · To-Be 를 그대로 읽는다(새 판정 · 만든 수량 없음)
import { describe, expect, it } from 'vitest'

import type { RefItem } from '../../target'
import { asIsMap, type AxisProxyState } from '../../v4/as-is'
import type { V4View } from '../../v4/compose'
import { DOMAINS, type Domain } from '../../v4/definition'
import { allTaskPlans, workspacePlan } from '../../v4/plan'
import { toBeMap, type ConfirmLink } from '../../v4/to-be'
import { planWorkspaces } from '../../v4/workspace'
import { nextActionOf, WAIT_LABEL, wsForTask } from '../next-action'
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

describe('nextActionOf — 지금 할 일', () => {
  const v = view()
  const r = ranksOf(v)
  const first = r.actionRank[0]

  it('활동이 있고 그 묶음 계획이 저장됨 → start: 계획의 활동 링크 · 저장 계획 수량 그대로', () => {
    expect(first).toBeTruthy()
    const ws = wsForTask(first.task, v)!
    const a = nextActionOf(v, r, { byTemplate: { [ws]: {} } })!
    const p = v.taskPlans.find((x) => x.task === first.task)!
    expect(a.kind).toBe('start')
    expect(a.href).toBe(first.href)
    expect(a.ws).toBe(ws)
    expect(a.quantity).toEqual({ unit: p.quantity.unit, planned: p.quantity.planned, done: p.quantity.done, source: 'saved' })
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
    expect(nextActionOf(v, none, { byTemplate: { [ws]: {} } })!.kind).toBe('supply')
    expect(nextActionOf(v, none, { byTemplate: {} })!.kind).toBe('plan')
  })
  it('창작 세트 없는 · 보류 · 단계 잠금은 wait — 이유만, 정확한 원인을 모르면 모른다고', () => {
    for (const reason of ['canon_hold', 'stage_locked'] as const) {
      const a = nextActionOf(v, { needRank: [], actionRank: [], notActionable: [{ task: 'r.central_meaning' as never, reason }] }, null)!
      expect(a.kind).toBe('wait')
      expect(a.blocked).toBe(reason)
    }
    expect(WAIT_LABEL.no_next_activity).toContain('몰라요')
  })
  it('관련성 미확인만 있으면 추천하지 않는다(null) · 순위가 없으면 null', () => {
    expect(nextActionOf(v, { needRank: [], actionRank: [], notActionable: [{ task: 'r.central_meaning' as never, reason: 'relevance_unknown' }] }, null)).toBeNull()
    expect(nextActionOf(v, null, null)).toBeNull()
  })
})
