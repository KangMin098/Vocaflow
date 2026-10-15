// apps/web/src/lib/csat/map/v62/__tests__/pm4b-e-isolated.test.ts
//
// P-M4b-05 — 원래 E(테스트 교재) 브라우저 시나리오는 SKIP(자연 상태에 지도 연습 줄 0) 그대로 둔다. 여기서는 **DB 를 건드리지 않고**
// 합성 수요(지도 연습) + 공장 재고로 실제 공급 함수(supplyFor · supplyStep · ledgerNote)를 돌려 화면에 나갈 단계 · 문구를 확인한다.
// 판정 이름: ISOLATED_CONTRACT_PASS — 화면 렌더(레이아웃 · 포커스)나 실제 제품 상태의 재현이 아니다. 공장 연결 증거도 아니다.
// 지금 제품 화면(TaskInspector)은 factoryStock 을 null 로 넘긴다 — 재고를 화면에서 조회하지 않는다(「조회하지 않았다」 문구).
import { describe, expect, it } from 'vitest'

import type { DemandLine, WorkspaceDemand } from '../demand'
import { supplyFor, type SupplyInput } from '../supply'
import { ledgerNote, SUPPLY_STEP_LABEL, supplyStep, type SupplyLedger } from '../supply-ledger'

const line = (role: DemandLine['role']): DemandLine => ({
  role, task: 'v.contextual_sense' as DemandLine['task'], taskKeys: [], csatTypes: ['R-VOCAB'], quantity: { n: 3, unit: '문항' },
  requires: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false }, reuse: true, reason: 'stage_repair',
})
const demand = { key: 'wd-iso', template: null, workspaceId: null, goalVersion: 1, planVersion: 1, definitionVersion: 'v6.2', asOf: '2026-10-15T00:00:00Z', core: 'v.contextual_sense', support: [], purpose: { need: null, evidence: 'iso', independentItems: null, unknowns: [] }, lines: [line('guided_practice')] } as unknown as WorkspaceDemand
const input = (factoryStock: SupplyInput['factoryStock']): SupplyInput => ({ unseenCheckItems: [], transferItems: [], transferDrafts: 0, study: { items: [], withheld: 0, sharedPassageUnchecked: true }, factoryStock })
const LEDGERS: SupplyLedger[] = [{ status: 'not_installed' }, { status: 'no_workspace' }, { status: 'error' }, { status: 'installed', lines: {} }]

describe('E 격리(ISOLATED_CONTRACT_PASS) — 지도 연습 수요 + 공장 재고(테스트 교재) · 검수 자격 없음', () => {
  const s = supplyFor(demand, input({ 'R-VOCAB': 49353 }))
  const l = s.lines[0]!
  it('수요 줄은 남고 재고는 「후보」 — 학습 가능 0 · 납품 0 · 공급 자격 미검수', () => {
    expect(l.role).toBe('guided_practice')
    expect(l.state).toBe('factory_candidate')
    expect(l.delivered).toHaveLength(0)
    expect(l.shortfall).toBe(3)
    expect(l.qualification).toMatchObject({ rights: null, content: null, teaching: null, runnable: false })
    expect(s.anyAvailable).toBe(false)
  })
  it('화면 단계 = 「교재 재고 있음 · 이 학습용 검수 대기」 — 기록 상태와 무관하게 「지금 학습」 · 주문 · 공급 완료로 올라가지 않는다', () => {
    for (const lg of LEDGERS) {
      const step = supplyStep(l, 'v.contextual_sense', lg)
      expect(step, lg.status).toBe('stock_review_wait')
      expect(SUPPLY_STEP_LABEL[step]).toBe('교재 재고 있음 · 이 학습용 검수 대기')
      expect(ledgerNote(lg).length).toBeGreaterThan(0)
    }
  })
  it('실행 가능한 학습 CTA 없음 — 공급 줄에는 링크 대상(delivered ref)이 없다', () => {
    expect(l.delivered.map((d) => d.ref)).toEqual([])
  })
  it('대조: 지금 제품 화면처럼 재고를 조회하지 않으면(null) 「없음」 으로 단정하지 않고 확인 필요', () => {
    const n = supplyFor(demand, input(null)).lines[0]!
    expect(n.state).toBe('needs_review')
    expect(supplyStep(n, 'v.contextual_sense', { status: 'not_installed' })).toBe('needs_review')
  })
})
