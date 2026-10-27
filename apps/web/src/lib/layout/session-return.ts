// apps/web/src/lib/layout/session-return.ts
//
// 풀스크린 학습 세션 종료 시 "제자리 복귀" 경로 계산.
// SessionFrame 은 상단 X/Esc 를 ?from= 으로 스스로 처리하지만, 세션 컴포넌트
// 내부의 자체 닫기·완료 버튼은 서버/클라이언트 페이지가 계산한 backHref 를 받아 쓴다.

/**
 * 내부 절대경로만 허용 (open-redirect 차단). 아니면 null.
 * `/\evil.example` 은 `//` 검사를 지나지만 브라우저(WHATWG URL)는 `http://evil.example/` 로 읽는다 — 역슬래시·제어문자·공백을
 * 거부하고(lib/auth/redirect `safeInternalPath` 와 같은 규칙), 마지막으로 URL 해석 결과가 같은 출처인지 확인한다(리뷰 2026-10-27).
 */
export function sanitizeInternalPath(p: string | null | undefined): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007F\\]/.test(p) || p.includes('://')) return null
  try {
    const u = new URL(p, 'http://internal.invalid')
    if (u.origin !== 'http://internal.invalid') return null
  } catch {
    return null
  }
  return p
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
