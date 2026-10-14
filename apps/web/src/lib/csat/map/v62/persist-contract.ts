// apps/web/src/lib/csat/map/v62/persist-contract.ts
//
// v6.2 P-F4b — 영속 수요 · 주문 · 공급의 **서버 계약**(순수 · DB 없음). 표는 승인안 B 전까지 만들지 않는다.
//   ① 정규 본문(canonical) — 같은 학습자 · 같은 요청이면 같은 문자열. P-F1 의 fnv 키는 화면 표시용 짧은 키일 뿐 충돌 저항이 없다 →
//      영속 주문은 정규 본문 전체의 SHA-256(서버) + 저장된 본문과의 **본문 비교**로 같은 키 · 다른 본문을 거절한다(P-M2b 와 같은 원칙).
//   ② 주문 상태 기계 — 서버가 전이를 검증한다. 실제 백그라운드 생산이 없으면 'producing' 으로 갈 수 없다(실행 기록이 있어야 한다).
// 학습자 id 는 정규 본문에 넣되 클라이언트 값이 아니라 서버 인증 값을 넣는다(호출자 책임 · 테스트 고정).

import { createHash } from 'node:crypto'

import type { WorkspaceDemand } from './demand'

/** 정규 본문 — 키 순서 고정 · 시각(asOf) 제외 · 학습자 id 는 서버가 넣는다 */
export function canonicalDemand(userId: string, d: WorkspaceDemand): string {
  return JSON.stringify({
    v: 1,
    user: userId,
    template: d.template,
    workspaceId: d.workspaceId,
    goalVersion: d.goalVersion,
    planVersion: d.planVersion,
    definitionVersion: d.definitionVersion,
    core: d.core,
    lines: d.lines.map((l) => ({ role: l.role, task: l.task, n: l.quantity.n, types: [...l.csatTypes].sort(), keys: [...l.taskKeys].sort(), requires: l.requires, reason: l.reason })),
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
  | 'delivered' // 적격 산출물이 Workspace 에 공급됨
  | 'held' // 권리 · Gold · 검수 · 원천 문제로 보류
  | 'failed' // 생산 · 검수 실패(이유 필수)

const NEXT: Record<OrderState, readonly OrderState[]> = {
  requested: ['stock_search', 'held', 'failed'],
  stock_search: ['delivered', 'awaiting_production', 'held', 'failed'],
  awaiting_production: ['producing', 'held', 'failed'],
  producing: ['reviewing', 'failed'],
  reviewing: ['delivered', 'held', 'failed'],
  delivered: [],
  held: ['stock_search', 'awaiting_production', 'failed'],
  failed: ['requested'],
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
  if ((to === 'held' || to === 'failed') && !ev.reason) return { ok: false, why: '보류 · 실패는 이유가 필요하다' }
  return { ok: true }
}

export const ORDER_STATE_LABEL: Record<OrderState, string> = {
  requested: '요청 기록됨',
  stock_search: '기존 자료 찾는 중',
  awaiting_production: '생산 대기(승인 · 배정 전)',
  producing: '생산 중',
  reviewing: '검수 중',
  delivered: '공급 완료',
  held: '보류',
  failed: '실패',
}
