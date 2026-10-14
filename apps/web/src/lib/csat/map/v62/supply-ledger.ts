// apps/web/src/lib/csat/map/v62/supply-ledger.ts
//
// v6.2 P-F8e — 학습자 화면의 「자료 공급 단계」(순수). 계산된 공급(`supplyFor`)과 **영속 주문 · 공급 기록**을 합쳐 한 줄의 단계를 정한다.
// 원칙: 「주문됨 · 생산 중 · 검수 중 · 공급 완료」는 **실제 DB 주문 · 공급 행이 있을 때만** 쓴다.
//   기록 표가 없으면(승인안 B 설치 전) · 읽다가 실패하면 그 단계로 올라가지 않는다 — 계산된 공급 상태까지만.
//   그리고 「기록이 없다」와 「기록을 못 읽었다」를 다르게 말한다(못 잼 ≠ 없음).

import type { MaterialRole } from './demand'
import type { OrderState } from './persist-contract'
import type { SupplyLine } from './supply'

/** 서버가 읽은 영속 기록 — 사용자 · Workspace 소유 확인 뒤의 값만 */
export type SupplyLedger =
  | { status: 'not_installed' }
  /** 이 묶음(Workspace)이 저장되지 않았다 — 영속 수요가 없으니 주문도 없다 */
  | { status: 'no_workspace' }
  | { status: 'error' }
  | { status: 'installed'; lines: Record<string, LedgerLine> }

export interface LedgerLine {
  /** 그 줄의 최신 주문 상태(주문이 없으면 null) */
  order: { state: OrderState; seq: number } | null
  /** 그 줄에 실제로 공급된 산출물 수 */
  delivered: number
}

export const ledgerKey = (task: string, role: MaterialRole) => `${task}|${role}`

export type SupplyStep =
  | 'learn_now' // 지금 학습할 수 있는 검수 자료(계산 · 또는 실제 공급 행)
  | 'not_ready' // 지금은 만들 · 공급할 경로가 없음
  | 'stock_review_wait' // 공장 재고는 있으나 이 학습용 검수 전
  | 'release_wait' // 자료는 있으나 출시 승인 대기
  | 'needs_review' // 근거 · 원문 · 권리 확인 필요
  | 'orderable' // 만들 공정은 있으나 아직 주문 안 함
  | 'ordered' // 실제 주문 행 있음(요청 · 재고 검색 · 생산 대기)
  | 'producing' // 실제 생산 실행 기록 있음
  | 'reviewing' // 생성물 검수 중
  | 'held' // 보류(이유 있음)
  | 'delivered' // 실제 공급 행 있음

export const SUPPLY_STEP_LABEL: Record<SupplyStep, string> = {
  learn_now: '지금 학습할 수 있어요',
  not_ready: '아직 준비되지 않은 자료',
  stock_review_wait: '교재 재고 있음 · 이 학습용 검수 대기',
  release_wait: '자료 준비됨 · 공개 승인 대기',
  needs_review: '근거 · 원문 확인 필요',
  orderable: '만들 수 있는 자료 · 아직 주문 안 함',
  ordered: '주문됨',
  producing: '만드는 중',
  reviewing: '검수 중',
  held: '보류됨',
  delivered: '공급 완료',
}

/** 기록 상태를 학습자 문장으로 — 화면 한 줄 */
export function ledgerNote(ledger: SupplyLedger): string {
  if (ledger.status === 'installed') return '주문 · 공급 단계는 실제 기록에서 읽었어요.'
  if (ledger.status === 'no_workspace') return '학습 묶음을 저장하면 그 묶음의 주문 · 공급 기록이 이어져요.'
  if (ledger.status === 'error') return '주문 · 공급 기록을 지금 읽지 못했어요 — 주문 여부는 표시하지 않아요.'
  return '주문 · 공급 기록은 아직 열리지 않았어요 — 「주문됨 · 공급 완료」는 실제 기록이 생기면 표시돼요.'
}

/**
 * 한 줄의 공급 단계. 순서: 실제 공급 행 → 실제 주문 상태 → 계산된 공급 상태.
 * 실제 기록이 없으면(not_installed · error · 행 없음) 주문 계열 단계로 가지 않는다.
 */
export function supplyStep(line: SupplyLine, task: string, ledger: SupplyLedger): SupplyStep {
  const rec = ledger.status === 'installed' ? ledger.lines[ledgerKey(task, line.role)] ?? null : null
  if (rec && rec.delivered > 0) return 'delivered'
  if (rec?.order) {
    switch (rec.order.state) {
      case 'requested':
      case 'stock_search':
      case 'awaiting_production':
        return 'ordered'
      case 'producing':
        return 'producing'
      case 'reviewing':
        return 'reviewing'
      case 'held':
        return 'held'
      case 'delivered':
        // 주문은 delivered 인데 공급 행이 없다 — DB 가 막는 상태라 여기 오면 기록이 어긋난 것: 공급 완료라고 하지 않는다
        break
      case 'failed':
        // 실패한 주문은 재주문 전까지 계산된 상태로 돌아간다
        break
    }
  }
  switch (line.state) {
    case 'available':
      return 'learn_now'
    case 'factory_candidate':
      return 'stock_review_wait'
    case 'order_spec_possible':
      return 'orderable'
    case 'awaiting_release':
      return 'release_wait'
    case 'needs_review':
      return 'needs_review'
    case 'unsupported':
      return 'not_ready'
  }
}
