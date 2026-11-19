// apps/web/src/lib/csat/map/v62/evidence-read.ts
//
// T-0078 — 개인화 지도 계산의 필수 원장(확인 첫 시도 · 수행 기록)을 읽었는가. 한 곳에서만 판정한다(compose · 화면 · 계획 저장 · 자료 받기).
//   성공한 빈 배열 [] = 정상(첫 사용자) · undefined = 읽지 못함(조회 실패 · 연결 · 결속 · 납품 조회 실패가 load.ts 에서 이 신호로 모인다).
//   읽지 못했는데 0건으로 계산하면 이미 한 학습을 「안 한 것」으로 되돌려 계획 · 공급을 다시 만든다 — 그래서 계산하지 않는다.
//   instrumentHashes(주석 현재성)만 모르는 경우는 기존 표시 계약(UNKNOWN)대로 두고 여기서 막지 않는다.

export type EvidenceRead = 'ok' | 'unavailable'

export function evidenceReadOf(data: { findAttempts?: readonly unknown[]; lifecycleActivity?: readonly unknown[] } | null | undefined): EvidenceRead {
  return data && Array.isArray(data.findAttempts) && Array.isArray(data.lifecycleActivity) ? 'ok' : 'unavailable'
}

/** 계획 저장 · 자료 받기 API 의 닫힌 응답 코드 */
export const EVIDENCE_UNAVAILABLE = 'evidence_unavailable' as const
