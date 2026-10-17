// apps/web/src/lib/csat/map/v62/persist-contract.ts
//
// v6.2 P-F4b — 영속 수요 · 주문 · 공급의 **서버 계약**(순수 · DB 없음). 표는 승인안 B 전까지 만들지 않는다.
//   ① 정규 본문(canonical) — 같은 학습자 · 같은 요청이면 같은 문자열. P-F1 의 fnv 키는 화면 표시용 짧은 키일 뿐 충돌 저항이 없다 →
//      영속 주문은 정규 본문 전체의 SHA-256(서버) + 저장된 본문과의 **본문 비교**로 같은 키 · 다른 본문을 거절한다(P-M2b 와 같은 원칙).
//   ② 주문 상태 기계 — 서버가 전이를 검증한다. 실제 백그라운드 생산이 없으면 'producing' 으로 갈 수 없다(실행 기록이 있어야 한다).
// 학습자 id 는 정규 본문에 넣되 클라이언트 값이 아니라 서버 인증 값을 넣는다(호출자 책임 · 테스트 고정).

import { createHash } from 'node:crypto'

import { canonicalJson } from './canonical-json'
import type { WorkspaceDemand } from './demand'

/**
 * 정규 본문 — 표준 정규 JSON(중첩 키까지 정렬 · Factory Integration v1.1 Codex I09) · 시각(asOf) 제외 · 학습자 id 는 서버가 넣는다.
 * v2: 중첩 `requires` 의 속성 순서가 서명을 바꾸던 결함 수정 · 지원 TASK(support)를 수요 revision 에 포함(바뀌면 새 수요).
 * 영속 서명이 아직 저장된 적이 없어(승인안 B 미적용) v1 → v2 로 옮길 데이터는 없다.
 */
export function canonicalDemand(userId: string, d: WorkspaceDemand): string {
  return canonicalJson({
    v: 2,
    user: userId,
    template: d.template,
    workspaceId: d.workspaceId,
    goalVersion: d.goalVersion,
    planVersion: d.planVersion,
    definitionVersion: d.definitionVersion,
    core: d.core,
    support: [...d.support].sort(),
    lines: d.lines.map((l) => ({ role: l.role, task: l.task, n: l.quantity.n, types: [...l.csatTypes].sort(), keys: [...l.taskKeys].sort(), requires: { ...l.requires }, reason: l.reason })),
  })
}

/** 영속 키 — SHA-256(정규 본문) 16진. 보안 서명이 아니라 충돌 저항 식별자 · 본문 비교와 함께 쓴다 */
export function demandSignature(userId: string, d: WorkspaceDemand): string {
  return createHash('sha256').update(canonicalDemand(userId, d)).digest('hex')
}

/** 같은 키로 이미 저장된 본문과 비교 — 같으면 재사용(멱등) · 다르면 충돌 */
export function sameStoredDemand(stored: string, userId: string, d: WorkspaceDemand): boolean {
  return stored === canonicalDemand(userId, d)
}

export type OrderState =
  | 'requested' // 수요에서 부족분이 생겨 주문 기록
  | 'stock_search' // 기존 재고 재검색
  | 'awaiting_production' // 생산 명세는 있으나 실행 승인 · 배정 대기
  | 'producing' // 실제 생산 실행 기록이 있을 때만
  | 'reviewing' // 생성물 검수 중
  | 'delivered' // 주문 수량 전량이 적격 산출물로 공급됨(I1-P)
  | 'partial' // 일부만 적격 공급 뒤 닫힘(이유 필수) — 남은 부족은 줄에서 계산해 shortfall 재주문(I1-P)
  | 'held' // 권리 · Gold · 검수 · 원천 문제로 보류
  | 'failed' // 생산 · 검수 실패(이유 필수)

const NEXT: Record<OrderState, readonly OrderState[]> = {
  requested: ['stock_search', 'held', 'failed'],
  stock_search: ['delivered', 'partial', 'awaiting_production', 'held', 'failed'],
  awaiting_production: ['producing', 'held', 'failed'],
  producing: ['reviewing', 'failed'],
  reviewing: ['delivered', 'partial', 'held', 'failed'],
  delivered: [],
  partial: [],
  held: ['stock_search', 'awaiting_production', 'failed'],
  // 실패는 그 주문의 끝이다 — 재생산은 같은 주문을 되살리지 않고 **새 주문**(이유 retry_after_failure · 부모 = 실패 주문).
  // SQL `factory_order_open` 과 같다(P-F7b).
  failed: [],
}

export interface TransitionEvidence {
  /** 실제 생산 실행 기록(드레인 청크 · 작업 id) — producing 진입에 필수 */
  productionRunId?: string | null
  /** 검수 결과 기록 — delivered 에 필수(재고 재사용 공급이면 그 자격 기록) */
  qualificationId?: string | null
  /** 보류 · 실패 이유 — 필수 */
  reason?: string | null
}

/** 서버 전이 검증 — 허용 전이 · 필수 근거가 모두 있어야 true */
export function canTransition(from: OrderState, to: OrderState, ev: TransitionEvidence = {}): { ok: true } | { ok: false; why: string } {
  if (!NEXT[from].includes(to)) return { ok: false, why: `전이 불가: ${from} → ${to}` }
  if (to === 'producing' && !ev.productionRunId) return { ok: false, why: '실제 생산 실행 기록 없이 생산 중으로 갈 수 없다' }
  if (to === 'delivered' && !ev.qualificationId) return { ok: false, why: '자격 기록 없이 공급 완료로 갈 수 없다' }
  if ((to === 'held' || to === 'failed' || to === 'partial') && !ev.reason) return { ok: false, why: '보류 · 실패 · 부분 납품은 이유가 필요하다' }
  return { ok: true }
}

/** 주문을 여는 이유 — 첫 주문은 initial, 그 뒤는 이유 · 부모가 필수(P-F7b, SQL `factory_order_open`) */
export type OrderReason = 'initial' | 'shortfall' | 'retry_after_failure' | 'plan_revision'

/**
 * 한 수요 줄에서 새 주문을 열 수 있는가. 열린 주문(delivered · failed 아님)이 있으면 불가(중복 주문 0).
 * 부분 공급 뒤 부족분은 shortfall, 실패 뒤 재생산은 retry_after_failure(직전이 failed 일 때만), PLAN 개정은 plan_revision.
 */
export function canOpenOrder(prev: { state: OrderState } | null, reason: OrderReason): { ok: true } | { ok: false; why: string } {
  if (!prev) return reason === 'initial' ? { ok: true } : { ok: false, why: '첫 주문은 initial 이어야 한다' }
  if (prev.state !== 'delivered' && prev.state !== 'failed' && prev.state !== 'partial') return { ok: false, why: '열린 주문이 있다' }
  if (reason === 'initial') return { ok: false, why: '재주문은 이유가 필요하다' }
  if (reason === 'retry_after_failure' && prev.state !== 'failed') return { ok: false, why: '재생산은 실패한 주문 뒤에만' }
  if (reason === 'shortfall' && prev.state !== 'partial' && prev.state !== 'delivered') return { ok: false, why: '부족분 재주문은 부분 납품 · 납품 뒤에만(I1-P)' }
  return { ok: true }
}

export const ORDER_STATE_LABEL: Record<OrderState, string> = {
  requested: '요청 기록됨',
  stock_search: '기존 자료 찾는 중',
  awaiting_production: '생산 대기(승인 · 배정 전)',
  producing: '생산 중',
  reviewing: '검수 중',
  delivered: '공급 완료',
  partial: '일부 공급 후 닫힘',
  held: '보류',
  failed: '실패',
}
