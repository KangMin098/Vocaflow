// apps/web/src/lib/csat/map/v4/__tests__/plan.test.ts
// rev4.0 3차 — TASK 학습계획 계약(정량 ≠ 정성 · 가용 콘텐츠에서만 계획량 · 조정은 계획만 · 증거 중복 없음). 고정 시각만.

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { DOMAINS, type Domain } from '../definition'
import { applyDraft, allTaskPlans, doneOf, repairGate, workspacePlan, type PlanActivity } from '../plan'
import { lifecycleEvidence } from '../../lifecycle-evidence'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'

const NOW = '2026-10-11T09:00:00.000Z'
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const attempt = (itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater', sessionId: 'fixture-session', contentHash: 'current', expectedContentHash: 'current' })
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

  it('수행량 ≠ 검증된 성취 — 도움 받은 · 합성 풀이는 수행량에 들어가지만 확인 상태는 바꾸지 않는다(4차)', () => {
    const helped = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')].map((a) => ({ ...a, helpLevel: 'viewed_first' }))
    const synth = [attempt('i3', false, '2026-09-12T00:00:00Z')].map((a) => ({ ...a, synthetic: true }))
    const a = asIs({ attempts: [...helped, ...synth] })
    const p = build(a, 80).view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.quantity.done).toBe(3)
    expect(p.achievement).toBe('not_checked') // 독립 근거 0 — 직접 확인 판정 없음
    expect(a.tasks['r.central_meaning'].check).toMatchObject({ attemptedItems: 3, independentItems: 0 })
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

describe('Workspace 전체 경로 — 바로잡기 → 적용 → 다시 확인(5차)', () => {
  const T = ['t1', 't2', 't3']
  const view = (a: ReturnType<typeof asIs>, act: PlanActivity[]) => {
    const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
    const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: 12 }, transferTargets: { [KEY]: T.map((i) => ({ target: i, href: `/csat/practice/claim-support?item=${i}`, label: '다른 글에 적용' })) } })
    const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
    return workspacePlan(cm, a, toBe, plan, act).tasks.find((t) => t.task === 'r.central_meaning')!
  }
  const a = asIs({ attempts: verified }) // i1 · i2 오답 → 확정(REPAIR)
  // LM-G1.1 — 바로잡기는 정답(isCorrect true)이어야 단계를 넘긴다. 이 묶음은 「다시 맞힌」 경로라 정답으로 둔다(틀린 재시도는 plan-lm-g1-1 T02 · T03)
  const later = (item: string, phase: string, day: number, ok: boolean | null = true): PlanActivity => ({ itemRef: item, taskKey: KEY, phase, isCorrect: ok, answeredAt: `2026-09-${String(day).padStart(2, '0')}T00:00:00Z` }) // ISO 처럼 두 자리(문자열 비교 — lifecycle-evidence 와 같은 방식)

  it('① 확정 직후 = 바로잡기 · 다음 활동은 막힌 확인 문항', () => {
    const p = view(a, [])
    expect(p.stage).toBe('repair')
    expect(p.next?.href).toBe('/csat/item/i1')
    expect(p.achievement).toBe('need_confirmed')
  })

  it('② 막힌 문항을 다시 맞히면 = 다른 글에 적용(2지문) · 다음 활동은 연습 화면의 전이 문항', () => {
    const p = view(a, [later('i1', 'practice', 12), later('i2', 'practice', 13)])
    expect(p.stage).toBe('transfer')
    expect(p.quantity).toMatchObject({ available: 2, done: 0, rule: 'transfer_pool' })
    expect(p.next?.href).toBe('/csat/practice/claim-support?item=t1')
    const one = view(a, [later('i1', 'practice', 12), later('i2', 'practice', 13), later('t1', 'transfer', 14)])
    expect(one.next?.href).toBe('/csat/practice/claim-support?item=t2') // 한 지문 뒤에는 아직 안 한 다음 지문
  })

  it('③ 적용 2지문 뒤 = 다시 확인 · 다음 활동은 아직 안 본 확인 문항 · 성취는 여전히 직접 확인 결과(수행 ≠ 성취)', () => {
    const p = view(a, [later('i1', 'practice', 12), later('i2', 'practice', 13), later('t1', 'transfer', 14), later('t2', 'transfer', 15)])
    expect(p.stage).toBe('recheck')
    expect(p.next?.href).toMatch(/^\/csat\/item\/i[345]$/)
    expect(p.achievement).toBe('need_confirmed')
  })

  it('④ 확정 전 수행은 바로잡기로 세지 않는다', () => {
    const p = view(a, [later('i1', 'practice', 9), later('i2', 'practice', 9)])
    expect(p.stage).toBe('repair')
  })
})

describe('자료 소진 안내(FAST LOOP v3 · B)', () => {
  it('확인 문항을 다 봐 단계가 잠기면 「새 자료 필요」(material_needed) — 「앞 단계를 마치면」(stage_locked) 이 아니다', () => {
    // 5문항 모두 정답(독립) — 확정 전이라 확인 단계인데 안 본 문항 0
    const all = ITEMS.map((i, k) => attempt(i, true, `2026-09-1${k}T00:00:00Z`))
    const p = build(asIs({ attempts: all }), 80).view.tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.unresolved).toContain('material_needed')
    expect(p.unresolved).not.toContain('stage_locked')
  })
})

describe('FI-011 창작 바로잡기 — 교수 · 안내 연습 자료로 성공 판정', () => {
  // 확정(2 오답) 뒤 바로잡기 단계 · 바로잡기 자료 = 안내 연습 g1 · 원리 설명 m1(창작 · 별도 자격)
  const repairTargets = { [KEY]: [{ target: 'authored:g1', href: '/csat/learn/g1?d=x', label: '바로잡기 · 안내 연습', role: 'guided_practice' as const }, { target: 'authored:m1', href: '/csat/learn/m1?d=y', label: '바로잡기 · 원리 설명 보기', role: 'model_explanation' as const }] }
  const buildR = (activity: PlanActivity[]) => {
    const a = asIs({ attempts: verified })
    const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
    const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: 2 }, repairTargets })
    const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
    return workspacePlan(cm, a, toBe, plan, activity).tasks.find((t) => t.task === 'r.central_meaning')!
  }
  // 서버 loader 가 정확한 납품 결속을 확인한 안내 연습 시도 = repairRole + 서버 수신 시각(기본 판단 시각과 같음)
  const act = (itemRef: string, ok: boolean | null, at: string, bind: { bound?: boolean; receivedAt?: string | null } = {}): PlanActivity => ({ itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, answeredAt: at, activity: 'practice', receivedAt: bind.receivedAt === undefined ? at : bind.receivedAt, ...(bind.bound === false || itemRef === 'authored:m1' ? {} : { repairRole: 'guided_practice' }) } as unknown as PlanActivity)
  it('안내 연습 정답(회차 뒤) = 바로잡기 성공 → 다음 단계', () => {
    expect(buildR([]).stage).toBe('repair')
    expect(buildR([act('authored:g1', true, '2026-09-12T00:00:00Z')]).stage).not.toBe('repair')
  })
  it('원리 설명 보기 · 안내 연습 오답 · 회차 전 기록은 성공이 아니다', () => {
    expect(buildR([act('authored:m1', true, '2026-09-12T00:00:00Z')]).stage).toBe('repair')
    expect(buildR([act('authored:g1', false, '2026-09-12T00:00:00Z')]).stage).toBe('repair')
    expect(buildR([act('authored:g1', true, '2026-09-10T12:00:00Z')]).stage).toBe('repair') // 확정(09-11) 전
  })
  it('Codex 반례 3 — 결속 없는 시도 · 서버 수신이 회차 앞이거나 없는 시도는 이번 회차를 진전시키지 않는다', () => {
    expect(buildR([act('authored:g1', true, '2026-09-12T00:00:00Z', { bound: false })]).stage).toBe('repair')
    expect(buildR([act('authored:g1', true, '2026-09-12T00:00:00Z', { receivedAt: '2026-09-10T12:00:00Z' })]).stage).toBe('repair')
    expect(buildR([act('authored:g1', true, '2026-09-12T00:00:00Z', { receivedAt: null })]).stage).toBe('repair')
  })
  it('Codex P1-1 — 안내 연습 오답 → 다음 행동은 그 안내 연습(다시 풀기) → 재시도 정답 → 다음 단계', () => {
    const wrong = act('authored:g1', false, '2026-09-12T00:00:00Z')
    const gate = repairGate(asIs({ attempts: verified }).tasks['r.central_meaning'], [wrong])
    expect(gate.succeeded).toBe(false)
    expect(gate.guidedTried).toEqual(['authored:g1'])
    expect(buildR([wrong, act('authored:g1', true, '2026-09-12T00:05:00Z')]).stage).not.toBe('repair')
  })
  it('Codex P1-2 — 안내 연습 정답은 다시 확인 · 적용 수에 들어가지 않고, 바로잡기 수와 lifecycle repairAt 에만 반영된다(PLAN 과 같은 판정)', () => {
    const t = asIs({ attempts: verified }).tasks['r.central_meaning']
    const g = act('authored:g1', true, '2026-09-12T00:00:00Z')
    expect(doneOf('recheck', t, [g])).toBe(0)
    expect(doneOf('repair', t, [g])).toBe(1)
    expect(repairGate(t, [g]).succeeded).toBe(true)
    const skill = { status: t.check!.status, verifiedAt: t.check!.verifiedAt, verifiedItems: t.check!.verifiedItems, check: { wrongItems: t.check!.wrongItems, lastWrongAt: t.check!.lastWrongAt ?? null } }
    const ev = lifecycleEvidence(skill, t.check!.verifiedItems.map((itemRef) => ({ itemRef, taskKey: KEY })), [{ ...g, isCorrect: true }] as never)
    expect(ev.transferAt).toBeNull()
    expect(ev.repairAt).toBe('2026-09-12T00:00:00Z')
    // 결속을 못 읽은 창작 practice 도 적용 · 다시 확인으로 새지 않는다(fail-closed) — 바로잡기 성공도 아니다
    const unbound = act('authored:g1', true, '2026-09-12T00:00:00Z', { bound: false })
    expect(doneOf('recheck', t, [unbound])).toBe(0)
    expect(lifecycleEvidence(skill, [], [{ ...unbound, isCorrect: true }] as never)).toMatchObject({ repairAt: null })
    expect(lifecycleEvidence(skill, t.check!.verifiedItems.map((itemRef) => ({ itemRef, taskKey: KEY })), [{ ...unbound, isCorrect: true }] as never).transferAt).toBeNull()
  })
  it('바로잡기 다음 행동 — 기출 막힌 문항은 기존대로 재시도 먼저(기출 바로잡기 보존) · 창작 안내 연습도 바로잡기 자료로 열린다', () => {
    expect(['/csat/item/i1', '/csat/item/i2']).toContain(buildR([]).next?.href)
    expect(buildR([]).quantity.available).toBeGreaterThanOrEqual(2)
  })
})

describe('FI-011 B — 바로잡기 성공 뒤 다시 확인 문항 부족은 순환이 아니다', () => {
  it('성공 · 적용 자료 없음 · 다시 확인 문항 부족 → stage recheck · material_needed (repair 로 되돌리지 않음)', () => {
    // 나머지 확인 문항 i3~i5 는 연습으로 이미 봤다(근거 아님 · 미노출 아님) → 다시 확인 재고 0
    const seenPractice = ['i3', 'i4', 'i5'].map((i) => ({ ...attempt(i, true, '2026-09-09T00:00:00Z'), activity: 'practice' }) as FindAttemptRow)
    const a = asIs({ attempts: [...verified, ...seenPractice] })
    const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
    const repairTargets = { [KEY]: [{ target: 'authored:g1', href: '/g1', label: 'g', role: 'guided_practice' as const }] }
    const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: 0 }, repairTargets })
    const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
    const success = [{ itemRef: 'authored:g1', taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: '2026-09-12T00:00:00Z', receivedAt: '2026-09-12T00:00:00Z', repairRole: 'guided_practice', activity: 'practice' } as unknown as PlanActivity]
    const p = workspacePlan(cm, a, toBe, plan, success).tasks.find((t) => t.task === 'r.central_meaning')!
    expect(p.stage).toBe('recheck')
    expect(p.unresolved).toContain('material_needed')
    expect(p.next).toBeNull()
  })
})
