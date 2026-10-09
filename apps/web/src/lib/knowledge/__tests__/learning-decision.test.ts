// apps/web/src/lib/knowledge/__tests__/learning-decision.test.ts
// 작업 2 — 확인된 학습 요구가 다음 할 일을 바꾸는가 · 추천마다 관찰 근거 · 원리 · 방법 · 정책 버전 · 이유가 남는가
import { describe, expect, it } from 'vitest'

import { findOutcome, type FindAttemptRow } from '../find-outcome'
import { DECISION_POLICY_VERSION, decideStep, type DecisionInput, type StepChain } from '../learning-decision'

const CHAIN: StepChain = {
  task: { id: 't1', slug: 'task-claim-support-link', version: 1 },
  method: { id: 'm1', slug: 'method-claim-support-marking', version: 3 },
  principle: { id: 'p1', slug: 'claim-support-relation', version: 2 },
}
const CONFIRM = ['2022#20', '2025#20', '2016#20'].map((itemRef) => ({ itemRef, href: `/csat/item/${itemRef.replace('#', '-')}#principle`, label: itemRef }))
const row = (itemRef: string, isCorrect: boolean): FindAttemptRow => ({
  itemRef, taskKey: 'claim-support', userId: 'u', phase: 'practice', isCorrect, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false,
})
const input = (rows: FindAttemptRow[], extra: Partial<DecisionInput> = {}): DecisionInput => ({
  stepKey: 'structure',
  findTaskId: 'B6-3',
  outcome: findOutcome(CONFIRM.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows),
  chain: CHAIN,
  confirm: CONFIRM,
  triedItems: [...new Set(rows.map((r) => r.itemRef))],
  practiceHref: '/csat/practice/claim-support',
  ...extra,
})

describe('decideStep — 학습 요구가 다음 할 일을 바꾼다', () => {
  it('기록 없음 → 확인 문항부터(약점 단정 없음)', () => {
    const d = decideStep(input([]))
    expect(d.action).toBe('start_check')
    expect(d.href).toBe('/csat/item/2022-20#principle')
  })
  it('한 문항만 막힘 → 아직 안 푼 다른 확인 문항으로 더 확인', () => {
    const d = decideStep(input([row('2022#20', false)]))
    expect(d.action).toBe('check_more')
    expect(d.href).toBe('/csat/item/2025-20#principle')
  })
  it('서로 다른 두 문항 막힘 → 그 원리의 방법 과제 연습', () => {
    const d = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    expect(d.action).toBe('practice_method')
    expect(d.href).toBe('/csat/practice/claim-support')
  })
  it('두 문항 모두 해냄 → 이 단계 연습을 처방하지 않고 다음 단계로', () => {
    const d = decideStep(input([row('2022#20', true), row('2025#20', true)]))
    expect(d.action).toBe('move_on')
    expect(d.href).toBeNull()
  })
  it('엇갈림 → 남은 확인 문항으로 더 확인', () => {
    expect(decideStep(input([row('2022#20', true), row('2025#20', false)])).action).toBe('check_more')
  })
  it('원리 사슬이 없으면 원리 기반 결정을 하지 않는다', () => {
    expect(decideStep(input([], { chain: { task: null, method: null, principle: null } })).action).toBe('no_principle')
  })
})

describe('추적 정보', () => {
  it('관찰 근거 · 원리 · 방법 · 과제 id · 버전 · 정책 버전 · 이유를 남긴다', () => {
    const d = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    expect(d.trace).toMatchObject({
      policyVersion: DECISION_POLICY_VERSION,
      stepKey: 'structure',
      findTaskId: 'B6-3',
      observation: { state: 'confirmed_need', checked: 2, wrong: 2, right: 0, items: ['2022#20', '2025#20'] },
      principleId: 'p1', methodId: 'm1', taskId: 't1',
      versions: { principle: 2, method: 3, task: 1 },
    })
    expect(d.reason).toMatch(/claim-support-relation/)
    expect(d.reason).toMatch(/method-claim-support-marking/)
  })
  it('원리 개정(버전 변경)은 같은 행동이라도 다른 근거로 남는다', () => {
    const a = decideStep(input([row('2022#20', false), row('2025#20', false)]))
    const b = decideStep(input([row('2022#20', false), row('2025#20', false)], { chain: { ...CHAIN, method: { ...CHAIN.method!, version: 4 } } }))
    expect(a.action).toBe(b.action)
    expect(a.trace.versions.method).not.toBe(b.trace.versions.method)
  })
  it('학습자 문구에 관리자 항목 slug 를 넣지 않는다', () => {
    for (const rows of [[], [row('2022#20', false)], [row('2022#20', false), row('2025#20', false)], [row('2022#20', true), row('2025#20', true)]]) {
      expect(decideStep(input(rows)).message).not.toMatch(/claim-support|method-|task-/)
    }
  })
})
