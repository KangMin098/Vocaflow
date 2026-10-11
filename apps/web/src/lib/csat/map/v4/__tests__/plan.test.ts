// apps/web/src/lib/csat/map/v4/__tests__/plan.test.ts
// rev4.0 3차 — TASK 학습계획 계약(정량 ≠ 정성 · 가용 콘텐츠에서만 계획량 · 조정은 계획만 · 증거 중복 없음). 고정 시각만.

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { DOMAINS, type Domain } from '../definition'
import { applyDraft, allTaskPlans, workspacePlan, type PlanActivity } from '../plan'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'

const NOW = '2026-10-11T09:00:00.000Z'
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const attempt = (itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater' })
const asIs = (o: Partial<AsIsInput> = {}) => asIsMap({ asOf: NOW, sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts: [], ...o })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }
const build = (a: ReturnType<typeof asIs>, goal: number | null, transfer = 0, activity: PlanActivity[] = []) => {
  const toBe = goal === null ? null : toBeMap({ asIs: a, goal: { score: goal, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: transfer } })
  const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
  return { toBe, plan, cm, view: workspacePlan(cm, a, toBe, plan, activity) }
}
const verified = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')]

describe('TASK 학습계획 — 정량 · 정성 분리', () => {
  it('확인 전: 계획량 = 안 본 확인 문항 수(출처 · 규칙 표시) · 성취는 「직접 확인 전」', () => {
    const { view } = build(asIs(), 80)
    const p = view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.need).toBe('CONFIRM')
    expect(p.quantity).toMatchObject({ available: 5, planned: 5, done: 0, remaining: 5, rule: 'unseen_check_items', source: 'available_content', adjustable: true })
    expect(p.achievement).toBe('not_checked')
    expect(p.criterion.length).toBeGreaterThan(0)
  })

  it('계획 진행 3/5 를 숙달률로 바꾸지 않는다 — 진행과 성취는 다른 칸', () => {
    const a = asIs({ attempts: [attempt('i1', true, '2026-09-10T00:00:00Z'), attempt('i2', true, '2026-09-11T00:00:00Z'), attempt('i3', true, '2026-09-12T00:00:00Z')] })
    const { view } = build(a, 80)
    const p = view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.quantity.done).toBe(3)
    expect(p.quantity).toMatchObject({ available: 5, planned: 5, done: 3, remaining: 2 }) // 안 본 2 + 푼 3 — 남은 2 가 실제로 풀 문항(리뷰 P1)
    expect(view.progress).toEqual({ planned: 5, done: 3 })
    expect(p.achievement).toBe('checking') // 3 문항 정답이어도 「확인됨」이 아니다
    expect(Object.keys(p).some((k) => /mastery|percent|rate/i.test(k))).toBe(false)
  })

  it('확정 뒤: 바로잡기 계획 = 막힌 문항 수 · 수행은 확정 뒤 그 문항 연습만', () => {
    const a = asIs({ attempts: verified })
    const act: PlanActivity[] = [
      { itemRef: 'i1', taskKey: KEY, phase: 'practice', answeredAt: '2026-09-12T00:00:00Z' }, // 확정 뒤 · 막힌 문항 → 수행
      { itemRef: 'i1', taskKey: KEY, phase: 'practice', answeredAt: '2026-09-13T00:00:00Z' }, // 같은 문항 다시 → 1 로 센다
      { itemRef: 'i2', taskKey: KEY, phase: 'practice', answeredAt: '2026-09-09T00:00:00Z' }, // 확정 전 → 안 센다
    ]
    const { view } = build(a, 80, 0, act)
    const p = view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.need).toBe('REPAIR')
    expect(p.quantity).toMatchObject({ available: 2, planned: 2, done: 1, remaining: 1, rule: 'blocked_items' })
    expect(p.achievement).toBe('need_confirmed')
  })

  it('콘텐츠가 없으면 계획 불가(null) — 권장량을 지어내지 않는다', () => {
    const { view } = build(asIs(), 80)
    const support = view.tasks.find((t) => t.task === 'r.discourse_function')!
    expect(support.quantity).toMatchObject({ available: null, planned: null, remaining: null, rule: null, source: 'none', adjustable: false })
    const vocab = allTaskPlans(asIs(), build(asIs(), 80).toBe, build(asIs(), 80).plan, []).find((t) => t.task === 'v.contextual_sense')!
    expect(vocab.quantity.planned).toBeNull()
    expect(vocab.unresolved).toContain('no_content')
  })

  it('적용 단계 잠김 — 확정 전에는 적용 계획이 없다(문항이 있어도)', () => {
    const { cm } = build(asIs(), 80, 12)
    expect(cm.stages.transfer.ready).toBe(false)
  })

  it('보류 TASK 는 계획 목록에 없다', () => {
    const { toBe, plan } = build(asIs(), 80)
    expect(allTaskPlans(asIs(), toBe, plan, []).some((p) => p.task.startsWith('x.') || p.task.startsWith('l.'))).toBe(false)
  })
})

describe('학습자 조정 — 계획만 바뀐다', () => {
  it('계획량은 0 ~ 가용량으로 자르고, 근거 · 성취 · 요구는 그대로', () => {
    const a = asIs({ attempts: verified })
    const { view } = build(a, 80)
    const before = view.tasks.find((t) => t.task === 'r.central_meaning')!
    const adj = applyDraft(view, { order: ['r.discourse_structure'], planned: { 'r.central_meaning': 99, 'r.discourse_function': 3 } })
    const after = adj.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(after.quantity.planned).toBe(2) // 가용량 2 를 넘길 수 없다
    expect(adj.tasks.find((t) => t.task === 'r.discourse_function')!.quantity.planned).toBeNull() // 계획 불가 TASK 는 조정 안 됨
    for (const k of ['evidence', 'basis', 'achievement', 'need', 'priority', 'criterion'] as const) expect(after[k]).toEqual(before[k])
    expect(adj.tasks[0].task).toBe('r.discourse_structure') // 순서만 바뀜
    expect(applyDraft(view, { order: [], planned: { 'r.central_meaning': 1 } }).progress).toEqual({ planned: 1, done: 0 })
  })

  it('조정이 As-Is 를 바꾸지 않는다', () => {
    const a = asIs({ attempts: verified })
    const snap = JSON.stringify(a)
    applyDraft(build(a, 80).view, { order: ['r.inference'], planned: { 'r.central_meaning': 0 } })
    expect(JSON.stringify(a)).toBe(snap)
  })
})

describe('증거 · 자료 중복 없음', () => {
  it('같은 TASK 가 두 Workspace 에 있어도 가용량 · 수행은 중심 Workspace 하나에서만', () => {
    const a = asIs({ attempts: verified })
    const { toBe, plan } = build(a, 80)
    const om = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.option-match')!
    const omView = workspacePlan(om, a, toBe, plan, [])
    const inOm = omView.tasks.find((t) => t.task === 'r.central_meaning')! // option-match 의 보조
    const inCm = build(a, 80).view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(inOm.quantity).toEqual(inCm.quantity) // 같은 값(중심 기준) — 더해지지 않는다
    expect(omView.progress).toBeNull() // option-match 의 중심(E3)은 이 픽스처에 확인 연결이 없어 계획 불가 · 보조 수는 세지 않음
  })
})
