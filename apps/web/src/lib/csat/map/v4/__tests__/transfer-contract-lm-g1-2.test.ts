// apps/web/src/lib/csat/map/v4/__tests__/transfer-contract-lm-g1-2.test.ts
//
// LM-G1.2 — 다른 글에 적용(TRANSFER) 계약: 경험 · 진행 · 준비 · 증거를 섞지 않는다.
//   정본 workspaces.json ws.central-meaning: quantity_policy 「… + 전이 2지문 + …」(운영량) · criterion 「독립 확인」(능력 판정은 CHECK).
//   1회 경험 ≠ 2지문 계획 완료 · 2회 수행 ≠ 숙달 · 같은 문항 반복 · 다른 TASK 키는 진행에 넣지 않음 · 학습자 계획량 조정은 운영량만.
// PLAN(stageNow · quantity) · lifecycle(nextLifecycleAction · 4칸)이 같은 진행 · 계획량으로 같은 다음 행동을 낸다. 고정 시각만.

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'
import { lifecycleCells } from '../../curriculum'
import { lifecycleEvidence, nextLifecycleAction, transferContract, transferTarget, type ActivityRow } from '../../lifecycle-evidence'
import { skillDiagnosis } from '../../skill-diagnosis'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { savedTransferOf } from '../compose'
import { DOMAINS, type Domain } from '../definition'
import { transferDoneOf, workspacePlan, type PlanActivity, type PlanOpts } from '../plan'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces, TRANSFER_PASSAGES } from '../workspace'

const NOW = '2026-10-11T09:00:00.000Z'
const KEY = 'claim-support'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5']
const T = 'r.central_meaning'
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const attempt = (itemRef: string, ok: boolean, at: string): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: at, activity: 'theater' })
const asIs = (o: Partial<AsIsInput> = {}) => asIsMap({ asOf: NOW, sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts: [], ...o })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }
const X = ['x1', 'x2', 'x3']
const build = (a: ReturnType<typeof asIs>, activity: PlanActivity[], transfer = 3, opts?: PlanOpts) => {
  const toBe = toBeMap({ asIs: a, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs: a, toBe, confirmLinks: links, transferItems: { [KEY]: transfer }, transferTargets: { [KEY]: X.slice(0, transfer).map((t) => ({ target: t, href: `/csat/practice/claim-support?item=${t}`, label: t })) } })
  const cm = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning')!
  return workspacePlan(cm, a, toBe, plan, activity, opts).tasks.find((x) => x.task === T)!
}
const VERIFIED = [attempt('i1', false, '2026-09-10T00:00:00Z'), attempt('i2', false, '2026-09-11T00:00:00Z')]
const act = (itemRef: string, at: string, o: Partial<PlanActivity> = {}): PlanActivity => ({ itemRef, taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: at, ...o })
const FIXED = act('i1', '2026-09-12T00:00:00Z') // 바로잡기 성공
const tr = (item: string, day: number, o: Partial<PlanActivity> = {}) => act(item, `2026-09-${String(day).padStart(2, '0')}T00:00:00Z`, { phase: 'transfer', isCorrect: null, ...o })
const SKILL = { status: 'verified', verifiedAt: '2026-09-11T00:00:00Z', verifiedItems: ['i1', 'i2'] }
const targets = ITEMS.map((itemRef) => ({ itemRef, taskKey: KEY }))
/** 화면의 lifecycle 4칸과 같은 입력 — 계획과 같은 진행 · 계획량을 실어 다음 행동을 계산 */
const lifecycleNext = (acts: PlanActivity[], planned: number | null) => {
  const rows = acts.map((a) => ({ ...a, isCorrect: a.isCorrect ?? null })) as ActivityRow[]
  const ev = { ...lifecycleEvidence(SKILL, targets, rows), transferDone: transferDoneOf(T, SKILL.verifiedAt, rows), transferPlanned: planned }
  return { ev, next: nextLifecycleAction('verified', ev) }
}

describe('LM-G1.2 TRANSFER 계약 — 경험 · 진행 · 준비 · 증거 분리', () => {
  it('0회: 적용 단계 · 0/2 · 경험 없음 · 준비 아님 · 증거 none', () => {
    const p = build(asIs({ attempts: VERIFIED }), [FIXED])
    expect(p.stage).toBe('transfer')
    expect(p.quantity).toMatchObject({ done: 0, planned: TRANSFER_PASSAGES })
    expect(transferContract(null, 0, 2)).toEqual({ experience: false, progress: { done: 0, planned: 2 }, ready: false, evidence: 'none' })
    expect(lifecycleNext([FIXED], 2).next).toBe('transfer')
  })

  it('1회: 경험은 있지만 2지문 계획 완료가 아니다 — PLAN · lifecycle 모두 「적용」 · 4칸은 「적용 1/2 · 첫 적용 경험」', () => {
    const acts = [FIXED, tr('x1', 13)]
    const p = build(asIs({ attempts: VERIFIED }), acts)
    expect(p.stage).toBe('transfer')
    expect(p.quantity).toMatchObject({ done: 1, planned: 2, remaining: 1 })
    expect(p.next?.href).toMatch(/x2/)
    const { ev, next } = lifecycleNext(acts, 2)
    expect(ev.transferAt).not.toBeNull() // 경험(transferAt)은 보존
    expect(next).toBe('transfer') // 예전 호환 판정은 여기서 'check' 였다 — 1회를 완료로 봄
    expect(nextLifecycleAction('verified', { ...ev, transferPlanned: undefined, transferDone: undefined })).toBe('check')
    const d = skillDiagnosis(targets, VERIFIED, new Date(NOW))
    const cell = lifecycleCells(d, true, ev).find((c) => c.stage === 'TRANSFER')!
    expect(cell.state).not.toBe('done')
    expect(cell.note).toMatch(/적용 1\/2/)
    expect(transferContract(ev.transferAt, 1, 2)).toMatchObject({ experience: true, ready: false, evidence: 'experience_only' })
  })

  it('2회(서로 다른 문항): 다시 확인으로 — 성취는 그대로(2회 ≠ 숙달) · 증거는 경험까지만', () => {
    const acts = [FIXED, tr('x1', 13), tr('x2', 14)]
    const p = build(asIs({ attempts: VERIFIED }), acts)
    expect(p.stage).toBe('recheck')
    expect(p.achievement).toBe('need_confirmed')
    expect(lifecycleNext(acts, 2).next).toBe('check')
    expect(transferContract('x', 2, 2)).toMatchObject({ ready: true, evidence: 'experience_only' })
  })

  it('같은 문항 반복은 1지문 — 적용 계속', () => {
    const acts = [FIXED, tr('x1', 13), tr('x1', 14), tr('x1', 15)]
    expect(build(asIs({ attempts: VERIFIED }), acts).quantity.done).toBe(1)
    expect(build(asIs({ attempts: VERIFIED }), acts).stage).toBe('transfer')
    expect(lifecycleNext(acts, 2).next).toBe('transfer')
  })

  it('다른 TASK 키의 적용 시도는 R5 진행이 아니다', () => {
    const acts = [FIXED, tr('x1', 13, { taskKey: 'evidence-locate' }), tr('x2', 14, { taskKey: 'evidence-locate' })]
    expect(build(asIs({ attempts: VERIFIED }), acts).quantity.done).toBe(0)
    expect(build(asIs({ attempts: VERIFIED }), acts).stage).toBe('transfer')
  })

  it('학습자 계획량 1로 조정(저장 계획 · 적용 단계) → 1회 뒤 다시 확인 · 계획량 1 표시 · 성취 그대로', () => {
    const opts: PlanOpts = { savedTransfer: { [T]: 1 } }
    const acts = [FIXED, tr('x1', 13)]
    const p = build(asIs({ attempts: VERIFIED }), acts, 3, opts)
    expect(p.stage).toBe('recheck')
    expect(p.achievement).toBe('need_confirmed')
    expect(build(asIs({ attempts: VERIFIED }), [FIXED], 3, opts).quantity).toMatchObject({ planned: 1, done: 0 })
    expect(lifecycleNext(acts, transferTarget(2, 1, TRANSFER_PASSAGES)).next).toBe('check')
  })

  it('저장 계획량은 「적용」 단계로 저장된 것만 · 0 · 비정수 무시 · 가용을 넘지 않음', () => {
    const saved = (stage: string, planned: number | null) => ({ v4: { saved: { status: 'installed', goalVersionId: 1, byTemplate: { 'ws.central-meaning': { workspaceId: 'w', template: 'ws.central-meaning', latest: { plan: { order: [T], tasks: [{ task: T, stage, planned, available: 2, rule: null }] } }, history: [] } } } } }) as unknown as Parameters<typeof savedTransferOf>[0]
    expect(savedTransferOf(saved('transfer', 1))).toEqual({ [T]: 1 })
    expect(savedTransferOf(saved('repair', 1))).toEqual({})
    expect(savedTransferOf(saved('transfer', 0))).toEqual({})
    expect(transferTarget(2, 5, 2)).toBe(5) // saved operating amount is not silently reduced
    expect(transferTarget(1, null, 2)).toBe(2) // shortage never silently lowers default
    expect(transferTarget(0, 1, 2)).toBeNull()
  })

  it('적용 자료 없음 → 적용을 건너뛰되 완료로 꾸미지 않는다(준비 null · 성취 그대로)', () => {
    const p = build(asIs({ attempts: VERIFIED }), [FIXED], 0)
    expect(p.stage).not.toBe('transfer')
    expect(p.achievement).toBe('need_confirmed')
    expect(transferContract(null, 0, null)).toMatchObject({ ready: null, evidence: 'none' })
  })

  it('CHECK 선통과(resolved) — 교수 경로 이수를 강제하지 않는다(lifecycle 다음 행동 없음 · REPAIR 요구 없음)', () => {
    const a = asIs({ attempts: [...VERIFIED, attempt('i3', true, '2026-09-15T00:00:00Z'), attempt('i4', true, '2026-09-16T00:00:00Z')] })
    expect(a.tasks[T].check?.status).toBe('resolved')
    const p = build(a, [])
    // 바로잡기부터 다시 하라고 하지 않는다. 기존 정본(to-be resolved_not_transferred)은 적용 경험이 없으면 「다른 글에 적용」 을 권한다 —
    // 강제 경로가 아니라 낮은 순위 요구이고, 성취는 resolved 그대로다(LM-G1.2 에서 바꾸지 않음)
    expect(p.need).toBe('TRANSFER')
    expect(p.stage).not.toBe('repair')
    expect(p.achievement).toBe('resolved')
    expect(nextLifecycleAction('resolved', lifecycleNext([], 2).ev)).toBeNull()
  })
})

describe('LM-G1.2 시각 불확실 보류 — As-Is 가 보류 수를 싣고 독립 근거로 세지 않는다', () => {
  it('확인 문항 한 개가 timingUncertain → timingHeld 1 · 독립 0 · 실패로 세지 않음', () => {
    const held = { ...attempt('i1', false, '2026-09-10T00:00:00Z'), timingUncertain: true }
    const a = asIs({ attempts: [held] })
    expect(a.tasks[T].check?.timingHeld).toBe(1)
    expect(a.tasks[T].check?.independentItems).toBe(0)
    expect(a.tasks[T].check?.status).not.toBe('verified')
  })
})
