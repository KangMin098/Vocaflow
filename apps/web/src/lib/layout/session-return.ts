// apps/web/src/lib/layout/session-return.ts
//
// 풀스크린 학습 세션 종료 시 "제자리 복귀" 경로 계산.
// SessionFrame 은 상단 X/Esc 를 ?from= 으로 스스로 처리하지만, 세션 컴포넌트
// 내부의 자체 닫기·완료 버튼은 서버/클라이언트 페이지가 계산한 backHref 를 받아 쓴다.

/** 내부 절대경로만 허용 (open-redirect 차단). 아니면 null. */
export function sanitizeInternalPath(p: string | null | undefined): string | null {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null
}

/**
 * 세션 종료 복귀 경로 — ?from 우선, 없으면 스코프 텍스트, 없으면 모듈 hub.
 *
 * @param from     ?from= 쿼리값 (신뢰 불가 — 내부경로 검증 후 사용)
 * @param text     스코프 진입한 texts.id (있으면 /text/{id}?mode=read 워크스페이스로)
 * @param hubHref  최종 fallback (모듈 hub, 예: '/flashcard')
 */
export function resolveSessionReturnHref(
  from: string | null | undefined,
  text: string | null | undefined,
  hubHref: string,
): string {
  const safeFrom = sanitizeInternalPath(from)
  if (safeFrom) return safeFrom
  if (text) return `/text/${text}?mode=read`
  return hubHref
}
