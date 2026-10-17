// apps/web/src/lib/csat/map/v62/__tests__/supply-ledger.test.ts
// v6.2 P-F8e — 「주문됨 · 공급 완료」는 실제 기록이 있을 때만. 기록 없음 · 못 읽음은 계산된 공급 단계까지만.
import { describe, expect, it } from 'vitest'

import type { OrderState } from '../persist-contract'
import type { SupplyLine, SupplyState } from '../supply'
import { ledgerKey, ledgerNote, supplyStep, type SupplyLedger } from '../supply-ledger'

const TASK = 'r.flow_order'
const line = (state: SupplyState, role: SupplyLine['role'] = 'guided_practice'): SupplyLine => ({
  role, state, delivered: [], shortfall: 1, reason: '', qualification: { producible: null, rights: null, content: null, teaching: null, assessment: null, learner: null, runnable: null },
})
const installed = (order: OrderState | null, delivered = 0): SupplyLedger => ({
  status: 'installed', lines: { [ledgerKey(TASK, 'guided_practice')]: { order: order ? { state: order, seq: 1 } : null, delivered } },
})
const STATES: SupplyState[] = ['available', 'readable_unreviewed', 'factory_candidate', 'order_spec_possible', 'awaiting_release', 'needs_review', 'unsupported']
const ORDERISH = new Set(['ordered', 'producing', 'reviewing', 'held', 'delivered', 'partially_delivered', 'delivered_count_unknown'])
const counted = (requested: number | null, valid: number | null, delivered: number, order: OrderState | null = null): SupplyLedger => ({
  status: 'installed', lines: { [ledgerKey(TASK, 'guided_practice')]: { order: order ? { state: order, seq: 1 } : null, delivered, requested, validDelivered: valid } },
})

describe('supplyStep', () => {
  it('기록 표가 없거나 못 읽으면 어떤 계산 상태에서도 주문 계열 단계가 나오지 않는다', () => {
    for (const ledger of [{ status: 'not_installed' }, { status: 'error' }, { status: 'no_workspace' }] as SupplyLedger[]) {
      for (const s of STATES) expect(ORDERISH.has(supplyStep(line(s), TASK, ledger)), `${ledger.status}/${s}`).toBe(false)
    }
  })
  it('설치됐지만 그 줄에 행이 없으면 계산 상태 그대로(주문 가능 ≠ 주문됨)', () => {
    expect(supplyStep(line('order_spec_possible'), TASK, { status: 'installed', lines: {} })).toBe('orderable')
    expect(supplyStep(line('factory_candidate'), TASK, { status: 'installed', lines: {} })).toBe('stock_review_wait')
    expect(supplyStep(line('available'), TASK, { status: 'installed', lines: {} })).toBe('learn_now')
  })
  it('실제 주문 상태 → 주문됨 · 만드는 중 · 검수 중 · 보류', () => {
    expect(supplyStep(line('order_spec_possible'), TASK, installed('requested'))).toBe('ordered')
    expect(supplyStep(line('order_spec_possible'), TASK, installed('awaiting_production'))).toBe('ordered')
    expect(supplyStep(line('order_spec_possible'), TASK, installed('producing'))).toBe('producing')
    expect(supplyStep(line('order_spec_possible'), TASK, installed('reviewing'))).toBe('reviewing')
    expect(supplyStep(line('order_spec_possible'), TASK, installed('held'))).toBe('held')
  })
  it('공급 완료는 실제 공급 행이 있을 때만 — 주문만 delivered 이고 행이 없으면 완료라고 하지 않는다', () => {
    expect(supplyStep(line('order_spec_possible'), TASK, installed('delivered', 0))).toBe('orderable')
    // I1-P — 행이 있어도 요청 수량 · 유효 공급을 모르면 「공급 완료」라 하지 않는다
    expect(supplyStep(line('order_spec_possible'), TASK, installed('delivered', 2))).toBe('delivered_count_unknown')
    expect(supplyStep(line('unsupported'), TASK, installed(null, 1))).toBe('delivered_count_unknown')
  })
  it('I1-P 요청 5 · 유효 2 = 일부 공급 · 유효 5 = 완료 · 유효 0(모두 철회) = 계산 상태로', () => {
    expect(supplyStep(line('order_spec_possible'), TASK, counted(5, 2, 2, 'partial'))).toBe('partially_delivered')
    expect(supplyStep(line('order_spec_possible'), TASK, counted(5, 5, 5, 'delivered'))).toBe('delivered')
    expect(supplyStep(line('order_spec_possible'), TASK, counted(1, 0, 1, 'delivered'))).toBe('orderable')
    expect(supplyStep(line('order_spec_possible'), TASK, counted(2, 0, 1, 'partial'))).toBe('orderable')
  })
  it('I1 — 읽을 수 있는 기존 해설은 「지금 학습」이 아니라 「지금 읽을 수 있음 · 수업용 검수 전」', () => {
    expect(supplyStep(line('readable_unreviewed', 'model_explanation'), TASK, { status: 'installed', lines: {} })).toBe('read_now')
    expect(supplyStep(line('readable_unreviewed', 'model_explanation'), TASK, { status: 'not_installed' })).toBe('read_now')
  })
  it('실패한 주문은 재주문 전까지 계산 상태로 돌아간다', () => {
    expect(supplyStep(line('order_spec_possible'), TASK, installed('failed'))).toBe('orderable')
  })
  it('다른 TASK · 역할의 기록은 이 줄에 쓰지 않는다', () => {
    expect(supplyStep(line('order_spec_possible', 'independent_check'), TASK, installed('producing'))).toBe('orderable')
    expect(supplyStep(line('order_spec_possible'), 'r.central_meaning', installed('producing'))).toBe('orderable')
  })
  it('기록 상태 문장 — 없음 · 못 읽음 · 읽음을 다르게 말한다', () => {
    const notes = (['not_installed', 'error', 'no_workspace'] as const).map((s) => ledgerNote({ status: s }))
    notes.push(ledgerNote({ status: 'installed', lines: {} }))
    expect(new Set(notes).size).toBe(4)
    expect(ledgerNote({ status: 'error' })).toMatch(/읽지 못했어요/)
  })
})
