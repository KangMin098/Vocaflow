// apps/web/src/lib/csat/map/v4/__tests__/plan-lm-g1-1.test.ts
//
// LM-G1.1 — R5 학습 단계 · 다음 행동. 수행량(doneOf)과 단계 준비(바로잡기 성공 근거)를 가른다.
//   G02 반례: 직접 확인 2 실패 → REPAIR 요구 → 바로잡기 2회 모두 실패 → 수행량 2 · 다음 행동은 여전히 REPAIR(실패 문항 재시도 링크).
//   성공 근거 = 확정(또는 다시 확인에서 막힌) 문항을 그 회차 안에서 **맞힌**(isCorrect === true) 시도 — lifecycle-evidence 와 같은 정의.
// 고정 시각만(시계 안 읽음).

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'
import { lifecycleEvidence, nextLifecycleAction } from '../../lifecycle-evidence'
import { skillDiagnosis, skillMessage } from '../../skill-diagnosis'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { DOMAINS, type Domain } from '../definition'
import { workspacePlan, type PlanActivity } from '../plan'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'
import { workspaceRows } from '../../v62/workspace-list'

const NOW = '2026-10-11T09:00:00.000Z'
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const attempt = (itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater' })
const asIs = (o: Partial<AsIsInput> = {}) => asIsMap({ asOf: NOW, sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts: [], ...o })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }
const T = 'r.central_meaning'
const build = (a: ReturnType<typeof asIs>, activity: PlanActivity[] = [], transfer = 2) => {
  const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: transfer }, transferTargets: { [KEY]: transfer > 0 ? [{ target: 'x1', href: '/csat/practice/claim-support?item=x1', label: 'x1' }, { target: 'x2', href: '/csat/practice/claim-support?item=x2', label: 'x2' }].slice(0, transfer) : [] } })
  const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
  const view = workspacePlan(cm, a, toBe, plan, activity)
  return { cm, plan, view, p: view.tasks.find((t) => t.task === T)! }
}
// 직접 확인: i1 · i2 실패(독립 첫 시도) → verified(09-11)
const VERIFIED = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')]
const act = (itemRef: string, ok: boolean | null, at: string, o: Partial<PlanActivity> = {}): PlanActivity => ({ itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, answeredAt: at, ...o })
const FAIL2 = [act('i1', false, '2026-09-12T00:00:00Z'), act('i2', false, '2026-09-12T01:00:00Z')]

describe('LM-G1.1 R5 단계 판정 — 수행량 ≠ 단계 준비', () => {
  it('T01 직접 확인 2 실패 → REPAIR · 바로잡기 단계 · 막힌 문항 링크', () => {
    const { p } = build(asIs({ attempts: VERIFIED }))
    expect(p.need).toBe('REPAIR')
    expect(p.stage).toBe('repair')
    expect(p.next?.href).toMatch(/i1|i2/)
  })

  it('T02 (G02) 바로잡기 2회 모두 실패 → 수행량 2 유지 · 다음 단계는 여전히 REPAIR(TRANSFER 아님)', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), FAIL2)
    expect(p.quantity.done).toBe(2)
    expect(p.stage).toBe('repair')
  })

  it('T03 실패한 바로잡기 재시도 — 이미 시도한 문항이어도 재시도 링크를 준다(정확한 막힌 문항)', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), FAIL2)
    expect(p.next).not.toBeNull()
    expect(['/csat/item/i1', '/csat/item/i2']).toContain(p.next!.href)
  })

  it('T04 적격 바로잡기 성공(정답) → 현행 정책대로 TRANSFER 준비', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [...FAIL2, act('i1', true, '2026-09-13T00:00:00Z')])
    expect(p.stage).toBe('transfer')
    expect(p.next?.href).toMatch(/x1|x2/)
  })

  it('T05 TRANSFER 1회 — 적용 경험(lifecycle)은 생기고 계획 수행량은 1/2 로 따로 센다', () => {
    const acts = [...FAIL2, act('i1', true, '2026-09-13T00:00:00Z'), act('x1', true, '2026-09-14T00:00:00Z', { phase: 'transfer' })]
    const { p } = build(asIs({ attempts: VERIFIED }), acts)
    expect(p.stage).toBe('transfer')
    expect(p.quantity).toMatchObject({ done: 1, planned: 2 })
    const ev = lifecycleEvidence({ status: 'verified', verifiedAt: '2026-09-11T00:00:00Z', verifiedItems: ['i1', 'i2'] }, ITEMS.map((itemRef) => ({ itemRef, taskKey: KEY })), acts.map((a) => ({ ...a, isCorrect: a.isCorrect ?? null })))
    expect(ev.transferAt).not.toBeNull()
  })

  it('T06 TRANSFER 자료 없음 → 적용 단계를 완료로 꾸미지 않는다(성취 그대로 · 적용 링크 없음)', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [act('i1', true, '2026-09-13T00:00:00Z')], 0)
    expect(p.stage).not.toBe('transfer')
    expect(p.achievement).toBe('need_confirmed')
    expect(p.next?.href ?? '').not.toMatch(/x1|x2/)
  })

  it('T10 정오 없음(null) 은 성공 근거가 아니다 → REPAIR 유지', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [act('i1', null, '2026-09-13T00:00:00Z'), act('i2', null, '2026-09-13T01:00:00Z')])
    expect(p.stage).toBe('repair')
  })

  it('T11 이전 회차(확정 전) 바로잡기 성공은 이번 회차로 승계하지 않는다', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [act('i1', true, '2026-09-10T12:00:00Z')])
    expect(p.stage).toBe('repair')
  })

  it('T12 다른 TASK 과제 키의 정답은 섞지 않는다', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [act('i1', true, '2026-09-13T00:00:00Z', { taskKey: 'other-key' })])
    expect(p.stage).toBe('repair')
  })

  it('T21 다른 TASK의 동일 문항 전이 기록은 현재 TASK의 다음 링크를 소진하지 않는다', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [
      act('i1', true, '2026-09-13T00:00:00Z'),
      act('x1', true, '2026-09-14T00:00:00Z', { taskKey: 'evidence-locate', phase: 'transfer' }),
      act('x2', true, '2026-09-15T00:00:00Z', { taskKey: 'evidence-locate', phase: 'transfer' }),
    ])
    expect(p.stage).toBe('transfer')
    expect(p.quantity.done).toBe(0)
    expect(p.next?.href).toBe('/csat/practice/claim-support?item=x1')
  })

  it('T22 같은 TASK의 완료한 전이 문항만 제외하고 다음 문항을 연다', () => {
    const { p } = build(asIs({ attempts: VERIFIED }), [
      act('i1', true, '2026-09-13T00:00:00Z'),
      act('x1', true, '2026-09-14T00:00:00Z', { phase: 'transfer' }),
    ])
    expect(p.quantity.done).toBe(1)
    expect(p.next?.href).toBe('/csat/practice/claim-support?item=x2')
  })

  it('T08 다시 확인 실패(still_needed) → 그 막힌 문항을 그 뒤에 맞혀야 바로잡기 완료(이전 성공 승계 없음)', () => {
    const a = asIs({ attempts: [...VERIFIED, attempt('i3', false, '2026-09-15T00:00:00Z')] })
    expect(a.tasks[T].check?.status).toBe('still_needed')
    // 확정 뒤 i1 성공(09-13)은 다시 확인 실패(09-15) 전 — 재바로잡기 근거가 아니다
    const before = build(a, [act('i1', true, '2026-09-13T00:00:00Z')])
    expect(before.p.stage).toBe('repair')
    expect(before.p.next?.href).toBe('/csat/item/i3')
    const after = build(a, [act('i1', true, '2026-09-13T00:00:00Z'), act('i3', true, '2026-09-16T00:00:00Z')])
    expect(after.p.stage).not.toBe('repair')
  })
})

describe('LM-G1.1 단일 출처 — Workspace 리스트 행이 막힌 단계를 다른 링크로 대체하지 않는다', () => {
  it('T13/T14 바로잡기 실패 2회 → 리스트 행 단계 · 링크 = 계획(REPAIR · 막힌 문항)', () => {
    const a = asIs({ attempts: VERIFIED })
    const { plan, view } = build(a, FAIL2)
    const fakeView = { plan, plans: { 'ws.central-meaning': view } } as unknown as Parameters<typeof workspaceRows>[0]
    const row = workspaceRows(fakeView).find((r) => r.id === 'ws.central-meaning')!
    const p = view.tasks.find((t) => t.task === T)!
    expect(row.stage).toBe(p.stage)
    expect(row.next?.href).toBe(p.next?.href)
  })

  it('T17 계획 단계가 막혀 링크가 없으면 Workspace 의 확인 문항 링크로 바꿔 열지 않는다', () => {
    const a = asIs({ attempts: VERIFIED })
    const { plan, view } = build(a, [act('i1', true, '2026-09-13T00:00:00Z')], 0)
    const p = view.tasks.find((t) => t.task === T)!
    const fakeView = { plan, plans: { 'ws.central-meaning': view } } as unknown as Parameters<typeof workspaceRows>[0]
    const row = workspaceRows(fakeView).find((r) => r.id === 'ws.central-meaning')!
    if (p.next === null && p.stage !== 'check' && p.stage !== 'recheck') expect(row.next).toBeNull()
    else expect(row.next?.href).toBe(p.next?.href)
  })
})

describe('LM-G1.1 lifecycle · CHECK 문구', () => {
  const targets = ITEMS.map((itemRef) => ({ itemRef, taskKey: KEY }))
  it('lifecycle 도 같은 반례에서 REPAIR', () => {
    const ev = lifecycleEvidence({ status: 'verified', verifiedAt: '2026-09-11T00:00:00Z', verifiedItems: ['i1', 'i2'] }, targets, FAIL2.map((a) => ({ ...a, isCorrect: a.isCorrect ?? null })))
    expect(ev.repairAt).toBeNull()
    expect(ev.repairTried).toBe(true)
    expect(nextLifecycleAction('verified', ev)).toBe('repair')
  })

  it('T07 독립 CHECK 2개 성공 → resolved 판정 그대로', () => {
    const d = skillDiagnosis(targets, [...VERIFIED, attempt('i3', true, '2026-09-15T00:00:00Z'), attempt('i4', true, '2026-09-16T00:00:00Z')], new Date(NOW))
    expect(d.status).toBe('resolved')
  })

  it('T09 바로잡기 · 적용 없이 CHECK 통과 — 문구가 「연습하고」 완주로 말하지 않는다 · 지연 확인 완료로 말하지 않는다', () => {
    const d = skillDiagnosis(targets, [...VERIFIED, attempt('i3', true, '2026-09-15T00:00:00Z'), attempt('i4', true, '2026-09-16T00:00:00Z')], new Date(NOW))
    const m = skillMessage(d)
    expect(m).not.toMatch(/연습하고/)
    expect(m).not.toMatch(/지연|오래 기억/)
    expect(m).toMatch(/능력이 늘었다는 판정은 아니에요/)
  })
})
