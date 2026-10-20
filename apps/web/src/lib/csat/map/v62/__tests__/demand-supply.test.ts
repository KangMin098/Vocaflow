// apps/web/src/lib/csat/map/v62/__tests__/demand-supply.test.ts
// v6.2 P-F1 · P-F2 — WorkspaceDemand(같은 계약으로 R5 · E3 · V2 · S5) · 기존 자산 공급 판정. 합성 fixture(고정 시각).
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'

import { asIsMap, type AxisProxyState } from '../../v4/as-is'
import type { V4View } from '../../v4/compose'
import { DOMAINS, type Domain } from '../../v4/definition'
import { allTaskPlans, workspacePlan } from '../../v4/plan'
import { toBeMap, type ConfirmLink } from '../../v4/to-be'
import { planWorkspaces } from '../../v4/workspace'

import { buildDemand } from '../demand'
import { supplyFor, type SupplyInput } from '../supply'

const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}?check=1`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString()
const att = (itemRef: string, ok: boolean, d: number): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: day(d), activity: 'theater', sessionId: 'fixture-session', contentHash: 'current', expectedContentHash: 'current' })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34), A1: REF.slice(29, 31), A8: REF.slice(28, 29) }

function view(attempts: FindAttemptRow[], asOfDay: number): V4View {
  const asIs = asIsMap({ asOf: day(asOfDay), sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts })
  const toBe = toBeMap({ asIs, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [KEY]: 0 }, transferTargets: {} })
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, workspacePlan(w, asIs, toBe, plan, [])]))
  return { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, []) }
}
const ctx = { workspaceId: null, planVersion: null, goalVersion: 7 }
const input = (o: Partial<SupplyInput> = {}): SupplyInput => ({ unseenCheckItems: [], transferItems: [], transferDrafts: 0, study: { items: [], withheld: 0, sharedPassageUnchecked: true }, factoryStock: { 'R-VOCAB': 51060, 'R-GRAMMAR': 15258, 'R-TOPIC': 413 }, exposure: { status: 'ok', events: [], passageKeys: {} }, fq: { status: 'not_installed' }, ...o })

describe('P-F1 WorkspaceDemand — 같은 계약으로 R5 · E3 · V2 · S5', () => {
  const v = view([], 12)
  it('네 TASK 모두 수요 줄을 만든다(콘텐츠가 없는 V2 · S5 도 — 재고 0 을 무관으로 바꾸지 않는다)', () => {
    for (const task of ['r.central_meaning', 'e.option_correspondence', 'v.contextual_sense', 's.form_scope']) {
      const d = buildDemand(v, task, null, ctx)
      expect(d.lines.length, task).toBeGreaterThan(0)
      expect(d.core).toBe(task)
    }
  })
  it('직접 확인 과제가 없는 TASK 는 그 사실을 unknowns 로 남긴다', () => {
    expect(buildDemand(v, 'v.contextual_sense', null, ctx).purpose.unknowns).toContain('no_direct_check_task')
  })
  it('보류 TASK(L · X)는 수요 줄 없이 canon_hold', () => {
    const d = buildDemand(v, 'l.sound', null, ctx)
    expect(d.lines).toEqual([])
    expect(d.purpose.unknowns).toContain('canon_hold')
  })
  it('멱등 키 — 같은 입력이면 같고, 계획 · 목표 버전이 바뀌면 다르다(시각은 넣지 않는다)', () => {
    const a = buildDemand(v, 'r.central_meaning', 'ws.central-meaning', ctx)
    expect(buildDemand(view([], 30), 'r.central_meaning', 'ws.central-meaning', ctx).key).toBe(a.key)
    expect(buildDemand(v, 'r.central_meaning', 'ws.central-meaning', { ...ctx, planVersion: 2 }).key).not.toBe(a.key)
    expect(buildDemand(v, 'r.central_meaning', 'ws.central-meaning', { ...ctx, goalVersion: 8 }).key).not.toBe(a.key)
  })
  it('확정 뒤(REPAIR) 수요 = 원문 분석 · 모델 설명 · 지도 연습, 독립 확인 줄은 정답 · 미노출 자격을 요구한다', () => {
    const r = buildDemand(view([att('i1', false, 10), att('i2', false, 11)], 12), 'r.central_meaning', 'ws.central-meaning', ctx)
    expect(r.lines.map((l) => l.role)).toEqual(['source_analysis', 'model_explanation', 'guided_practice'])
    const c = buildDemand(v, 'r.central_meaning', 'ws.central-meaning', ctx).lines.find((l) => l.role === 'independent_check')!
    expect(c.requires).toMatchObject({ gold: true, unseenByLearner: true, noExplanationBefore: true })
  })
})

describe('P-F2 공급 판정', () => {
  const v = view([], 12)
  it('사례 A — R5 독립 확인은 기존 출시 확인 문항(미노출)을 「열 수 있음 · 정식 자격 전」으로만 보인다(#281 E04), 새 생산 0', () => {
    const passageKeys = { i3: 'p3', i4: 'p4', i5: 'p5' }
    const s = supplyFor(buildDemand(v, 'r.central_meaning', 'ws.central-meaning', ctx), input({ unseenCheckItems: ['i3', 'i4', 'i5'], exposure: { status: 'ok', events: [], passageKeys } }))
    const c = s.lines.find((l) => l.role === 'independent_check')!
    expect(c.state).toBe('open_unqualified')
    expect(c.delivered.every((d) => d.source === 'check_task')).toBe(true)
    expect(c.qualification.assessment).toBeNull()
    expect(s.anyAvailable).toBe(false)
  })
  it('사례 B — V2 는 공장 재고가 있어도 「검수 전 후보」이지 학습 가능 · 평가 자격이 아니다', () => {
    const r = buildDemand(view([att('i1', false, 10), att('i2', false, 11)], 12), 'v.contextual_sense', null, ctx)
    const forced = { ...r, lines: [{ ...r.lines[0], role: 'guided_practice' as const }] }
    const s = supplyFor(forced, input())
    expect(s.lines[0].state).toBe('factory_candidate')
    expect(s.lines[0].qualification).toMatchObject({ assessment: false, runnable: false })
    expect(s.anyAvailable).toBe(false)
    // 독립 확인은 공장 재고로 대신하지 않는다
    const check = supplyFor(buildDemand(v, 'v.contextual_sense', null, ctx), input())
    expect(check.lines[0].state).toBe('unsupported')
  })
  it('사례 C — 이미 본(해설 본) 문항은 독립 확인으로 공급되지 않는다(미노출 목록 밖)', () => {
    const s = supplyFor(buildDemand(v, 'r.central_meaning', 'ws.central-meaning', ctx), input({ unseenCheckItems: [] }))
    const c = s.lines.find((l) => l.role === 'independent_check')!
    expect(c.delivered).toEqual([])
    expect(c.state).toBe('unsupported')
  })
  it('사례 D — 전이 초안만 있으면 출시 승인 대기(공급 가능으로 보이지 않음)', () => {
    const d = buildDemand(view([att('i1', false, 10), att('i2', false, 11)], 12), 'e.evidence_location', 'ws.evidence-locate', ctx)
    const t = { ...d, lines: [{ ...d.lines[0], role: 'transfer' as const }] }
    expect(supplyFor(t, input({ transferDrafts: 4 })).lines[0].state).toBe('awaiting_release')
  })
  it('「생성 중」 상태는 없다 — 영속 주문 · 작업 큐가 없으므로', () => {
    const s = supplyFor(buildDemand(v, 's.form_scope', null, ctx), input({ factoryStock: {} }))
    expect(JSON.stringify(s)).not.toMatch(/generating|in_production|생성 중/)
  })
})

describe('T-0056 — 목표가 있어도 직접 확인 전 보조 TASK 는 그 묶음에서 확인 수요를 남긴다', () => {
  // 실제 서버 관찰(CI 39367245139): 목표가 있는 학습자의 보조 TASK 에 계획 단계 · 요구가 없으면 첫 공급이 「새로 받을 자료 없음」이었다
  const base = view([], 12)
  const v = { ...base, taskPlans: base.taskPlans.filter((p) => p.task !== 'e.task_demand') }
  it('ws.evidence-locate 의 보조 e.task_demand — 단계 · 목표 요구가 없어도 independent_check(첫 공급)', () => {
    expect(v.toBe).not.toBeNull()
    const d = buildDemand(v, 'e.task_demand', 'ws.evidence-locate', ctx)
    expect(d.lines.map((l) => [l.role, l.reason])).toEqual([['independent_check', 'need_without_stage']])
  })
  it('묶음 밖 · 그 묶음의 보조가 아니면 기존 규칙 그대로 — 근거 없이 수요를 만들지 않는다', () => {
    expect(buildDemand(v, 'e.task_demand', null, ctx).lines).toEqual([])
    expect(buildDemand(v, 'e.task_demand', 'ws.central-meaning', ctx).lines).toEqual([])
  })
})
