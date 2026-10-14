// apps/web/src/lib/csat/map/v62/__tests__/persist-contract.test.ts
// v6.2 P-F4b · P-F6 — 영속 계약(서명 · 본문 비교 · 상태 기계) · 공급 충족도
import { describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canTransition, canonicalDemand, demandSignature, sameStoredDemand } from '../persist-contract'
import { fulfillmentOf, type SupplyLine } from '../supply'

const demand = (o: Partial<WorkspaceDemand> = {}): WorkspaceDemand => ({
  key: 'wd-x', template: 'ws.central-meaning', workspaceId: null, goalVersion: 7, planVersion: 1, definitionVersion: 'v4', asOf: '2026-10-14T00:00:00Z', core: 'r.central_meaning', support: [],
  purpose: { need: 'CONFIRM', evidence: 'observed', independentItems: null, unknowns: [] },
  lines: [{ role: 'independent_check', task: 'r.central_meaning', taskKeys: ['claim-support'], csatTypes: ['R-TOPIC'], quantity: { n: 2, unit: '문항' }, requires: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true }, reuse: true, reason: 'stage_check' }],
  ...o,
})

describe('영속 서명 · 본문 비교', () => {
  it('같은 학습자 · 같은 내용 = 같은 서명(asOf · 화면 키는 무관)', () => {
    expect(demandSignature('u1', demand())).toBe(demandSignature('u1', demand({ asOf: '2026-12-01T00:00:00Z', key: 'wd-other' })))
    expect(demandSignature('u1', demand())).toMatch(/^[0-9a-f]{64}$/)
  })
  it('학습자 · 계획 · 목표 버전 · 수량이 다르면 다른 서명', () => {
    const a = demandSignature('u1', demand())
    expect(demandSignature('u2', demand())).not.toBe(a)
    expect(demandSignature('u1', demand({ planVersion: 2 }))).not.toBe(a)
    expect(demandSignature('u1', demand({ goalVersion: 8 }))).not.toBe(a)
    const more = demand()
    more.lines[0] = { ...more.lines[0], quantity: { n: 3, unit: '문항' } }
    expect(demandSignature('u1', more)).not.toBe(a)
  })
  it('같은 키 · 다른 본문은 본문 비교로 거절', () => {
    const stored = canonicalDemand('u1', demand())
    expect(sameStoredDemand(stored, 'u1', demand())).toBe(true)
    expect(sameStoredDemand(stored, 'u2', demand())).toBe(false)
    expect(sameStoredDemand(stored, 'u1', demand({ planVersion: 9 }))).toBe(false)
  })
})

describe('주문 상태 기계', () => {
  it('실제 생산 실행 기록 없이 「생산 중」 불가', () => {
    expect(canTransition('awaiting_production', 'producing').ok).toBe(false)
    expect(canTransition('awaiting_production', 'producing', { productionRunId: 'run-1' }).ok).toBe(true)
  })
  it('자격 기록 없이 「공급 완료」 불가 · 보류/실패는 이유 필수 · 건너뛰기 불가', () => {
    expect(canTransition('reviewing', 'delivered').ok).toBe(false)
    expect(canTransition('reviewing', 'delivered', { qualificationId: 'q-1' }).ok).toBe(true)
    expect(canTransition('reviewing', 'held').ok).toBe(false)
    expect(canTransition('requested', 'delivered', { qualificationId: 'q' }).ok).toBe(false)
    expect(canTransition('delivered', 'producing', { productionRunId: 'r' }).ok).toBe(false)
  })
})

describe('공급 충족도', () => {
  const line = (o: Partial<SupplyLine>): SupplyLine => ({ role: 'independent_check', state: 'available', delivered: [{ ref: 'a', source: 'check_task' }], shortfall: 0, qualification: { producible: true, rights: true, content: true, teaching: true, assessment: true, learner: true, runnable: true }, reason: '', ...o })
  it('공급 < 필요량이면 「일부」 · 0 이면 「없음」', () => {
    expect(fulfillmentOf(line({}))).toBe('fully_supplied')
    expect(fulfillmentOf(line({ shortfall: 1 }))).toBe('partially_supplied')
    expect(fulfillmentOf(line({ delivered: [], shortfall: 2 }))).toBe('not_supplied')
  })
  it('평가 역할에서 평가 자격이 null(모름) · false 면 공급으로 세지 않는다', () => {
    expect(fulfillmentOf(line({ qualification: { producible: true, rights: true, content: true, teaching: true, assessment: null, learner: true, runnable: true } }))).toBe('not_supplied')
    expect(fulfillmentOf(line({ role: 'guided_practice', qualification: { producible: true, rights: null, content: null, teaching: null, assessment: null, learner: null, runnable: true } }))).toBe('fully_supplied')
  })
})
