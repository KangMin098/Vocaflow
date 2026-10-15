// apps/web/src/lib/csat/map/v4/__tests__/state-transitions.test.ts
// rev4.0 6차 P0-1 — 학습 상태 전이(합성 fixture · 재현 가능 · 고정 시각). 실제 학습자 성장의 증거가 아니다 — 판정 규칙이 일관되게 흐르는지만 본다.
//   A 확정 뒤 다시 확인 연속 2 정답 → resolved   B 다시 확인 실패 → 학습 요구 계속(still_needed → verified_need)
//   C 확정 뒤 120일 안 미해소 → expired          D 판정이 바뀌면 To-Be 요구가 다시 계산된다(REPAIR → TRANSFER/MAINTAIN · CONFIRM)
//   E MAP(As-Is) · PLAN(성취) · Workspace(단계) 가 같은 상태를 말한다   F 계획 수행량은 성취를 바꾸지 않는다
// 직접 확인 규칙(skill-diagnosis: 확정 2 · 재확인 연속 2 · 만료 120일)을 완화하지 않는다 — 규칙 상수를 그대로 쓴다.
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { RefItem } from '../../target'
import { CHECK_ITEMS, EXPIRY_DAYS, VERIFY_ITEMS } from '../../skill-diagnosis'

import { asIsMap, type AsIsInput, type AxisProxyState } from '../as-is'
import { DOMAINS, type Domain } from '../definition'
import { applyDraft, workspacePlan, type PlanActivity } from '../plan'
import { toBeMap, type ConfirmLink } from '../to-be'
import { planWorkspaces } from '../workspace'

const KEY = 'claim-support'
const TASK = 'r.central_meaning'
const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']
const links: Record<string, ConfirmLink[]> = { [KEY]: ITEMS.map((t) => ({ target: t, href: `/csat/item/${t}`, label: t })) }
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString()
const att = (itemRef: string, ok: boolean, d: number, extra: Partial<FindAttemptRow> = {}): FindAttemptRow => ({ userId: 'u', itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: day(d), activity: 'theater', ...extra })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }

/** 같은 기록 · 목표 · 기준 시점에서 시도만 바꿔 MAP · To-Be · PLAN · Workspace 를 함께 계산 */
function snapshot(attempts: FindAttemptRow[], asOfDay: number, activity: PlanActivity[] = []) {
  const input: AsIsInput = { asOf: day(asOfDay), sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: ITEMS }], attempts }
  const asIs = asIsMap(input)
  const toBe = toBeMap({ asIs, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: links })
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: links, transferItems: { [KEY]: 4 }, transferTargets: { [KEY]: ['t1', 't2', 't3'].map((i) => ({ target: i, href: `/csat/practice/claim-support?item=${i}`, label: '다른 글에 적용' })) } })
  const ws = [plan.primary, ...plan.others].find((w) => w?.id === 'ws.central-meaning') ?? null
  const view = ws ? workspacePlan(ws, asIs, toBe, plan, activity) : null
  const row = view?.tasks.find((t) => t.task === TASK) ?? null
  return { asIs, toBe, ws, view, row, need: toBe!.needs.find((n) => n.task === TASK) ?? null, status: asIs.tasks[TASK].status, check: asIs.tasks[TASK].check }
}

const verified = [att('i1', false, 10), att('i2', false, 11)] // 서로 다른 2문항 독립 오답 → 확정

describe('규칙 상수 — 완화하지 않았다', () => {
  it('확정 2 · 재확인 연속 2 · 만료 120일', () => {
    expect([VERIFY_ITEMS, CHECK_ITEMS, EXPIRY_DAYS]).toEqual([2, 2, 120])
  })
})

describe('A · B · C — 직접 확인 상태 전이', () => {
  it('확정 직후: verified_need · REPAIR · 성취 「필요 확인됨」', () => {
    const s = snapshot(verified, 12)
    expect(s.status).toBe('verified_need')
    expect(s.need?.type).toBe('REPAIR')
    expect(s.row?.achievement).toBe('need_confirmed')
  })

  it('A 다시 확인에서 확정에 쓰지 않은 문항 연속 2 정답 → resolved', () => {
    const s = snapshot([...verified, att('i3', true, 20), att('i4', true, 21)], 22)
    expect(s.status).toBe('resolved')
    expect(s.check?.status).toBe('resolved')
    expect(s.row?.achievement).toBe('resolved')
  })

  it('A 의 경계: 1문항만 맞히면 아직 해소가 아니다', () => {
    expect(snapshot([...verified, att('i3', true, 20)], 22).status).toBe('verified_need')
  })

  it('B 다시 확인에서 막히면 학습 요구가 이어진다(still_needed) — 성취 「필요 확인됨」 유지', () => {
    const s = snapshot([...verified, att('i3', false, 20)], 22)
    expect(s.check?.status).toBe('still_needed')
    expect(s.status).toBe('verified_need')
    expect(s.row?.achievement).toBe('need_confirmed')
    expect(s.need?.type).toBe('REPAIR')
  })

  it('B → A: 막힌 뒤 다른 문항 연속 2 정답이면 해소', () => {
    expect(snapshot([...verified, att('i3', false, 20), att('i4', true, 30), att('i5', true, 31)], 32).status).toBe('resolved')
  })

  it('B 의 경계: 정답 사이에 오답이 끼면 연속이 끊긴다', () => {
    expect(snapshot([...verified, att('i3', true, 20), att('i4', false, 21), att('i5', true, 22)], 23).status).toBe('verified_need')
  })

  it('C 확정 뒤 120일 안에 해소되지 않으면 만료', () => {
    expect(snapshot(verified, 11 + EXPIRY_DAYS - 1).status).toBe('verified_need')
    const s = snapshot(verified, 11 + EXPIRY_DAYS + 1)
    expect(s.status).toBe('expired')
    expect(s.row?.achievement ?? 'expired').toBe('expired')
  })

  it('C 기한 안에 해소했으면 기한이 지나도 만료가 아니다', () => {
    expect(snapshot([...verified, att('i3', true, 20), att('i4', true, 21)], 11 + EXPIRY_DAYS + 30).status).toBe('resolved')
  })

  it('독립 첫 시도만 — 해설 먼저 본 정답은 해소 근거가 아니다', () => {
    const s = snapshot([...verified, att('i3', true, 20, { helpLevel: 'viewed_first' }), att('i4', true, 21)], 22)
    expect(s.status).toBe('verified_need')
  })
})

describe('D — 판정이 바뀌면 To-Be 요구가 다시 계산된다', () => {
  it('확정 → REPAIR · 해소 → 적용 기록 없으면 TRANSFER · 만료 → 다시 CONFIRM', () => {
    expect(snapshot(verified, 12).need?.type).toBe('REPAIR')
    expect(snapshot([...verified, att('i3', true, 20), att('i4', true, 21)], 22).need?.type).toBe('TRANSFER')
    expect(snapshot(verified, 11 + EXPIRY_DAYS + 1).need?.type).toBe('CONFIRM')
  })
})

describe('E — MAP · PLAN · Workspace 가 같은 상태를 말한다', () => {
  it('확정: MAP verified_need · PLAN 성취 need_confirmed · Workspace 바로잡기 열림 · 확인 닫힘', () => {
    const s = snapshot(verified, 12)
    expect([s.status, s.row?.achievement, s.ws?.stages.repair.ready, s.ws?.stages.check.ready]).toEqual(['verified_need', 'need_confirmed', true, false])
  })
  it('해소: MAP resolved · PLAN 성취 resolved · Workspace 확인 「해소됨」 · 다시 확인 닫힘(resolved)', () => {
    const s = snapshot([...verified, att('i3', true, 20), att('i4', true, 21)], 22)
    expect([s.status, s.row?.achievement, s.ws?.stages.check.blocked, s.ws?.stages.recheck.blocked]).toEqual(['resolved', 'resolved', 'resolved', 'resolved'])
  })
})

describe('F — 계획 수행량은 성취를 바꾸지 않는다', () => {
  it('바로잡기 · 적용을 아무리 해도(계획 조정 포함) 성취 · MAP 상태는 직접 확인 판정 그대로', () => {
    const act: PlanActivity[] = [
      // LM-G1.1 — 바로잡기 성공(정답)이어야 적용 단계로 넘어간다
      { itemRef: 'i1', taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: day(12) },
      { itemRef: 'i2', taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: day(13) },
      { itemRef: 't1', taskKey: KEY, phase: 'transfer', answeredAt: day(14) },
      { itemRef: 't2', taskKey: KEY, phase: 'transfer', answeredAt: day(15) },
    ]
    const before = snapshot(verified, 16)
    const after = snapshot(verified, 16, act)
    expect(after.status).toBe(before.status)
    expect(after.row?.achievement).toBe(before.row?.achievement)
    expect(after.row?.stage).toBe('recheck') // 수행은 단계만 넘긴다
    const adjusted = applyDraft(after.view!, { order: [], planned: { [TASK]: 0 } })
    expect(adjusted.tasks.find((t) => t.task === TASK)?.achievement).toBe('need_confirmed')
  })
})
