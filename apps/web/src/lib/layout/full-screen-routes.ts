// apps/web/src/lib/layout/full-screen-routes.ts
//
// 풀스크린 (= 사이드바 + FlowNav 둘 다 숨김) 라우트 판정.
// 학습 세션 진입 시 working memory 보호(Sweller) — Calm UI 정합.
//
// 적용 라우트:
//   - /flashcard/play   · /spellforge/play   · /scriptquiz/play  (게임 play)
//   - /dictate/session                                            (받아쓰기 세션)
//   - /play/*  ((app) 라우트 그룹 — wordblitz 등 — 기존 풀스크린 그룹)
//
// 비포함 (의도적):
//   - /text/[id]          : 자체 Focus Mode(30초 무활동) 보유
//   - /dictate/setup      : 설정 단계, 사이드바 유지가 효율적
//   - /dictate/results    : 결과 검토, 다음 모듈 이동 빈번
//   - /text/new           : 입력 양식, 라이브러리 전환 유도
//   - /wordvault?view=*   : 쿼리 파라미터, 같은 hub 라우트

const FULL_SCREEN_PATTERNS: ReadonlyArray<(p: string) => boolean> = [
  // 게임 play 세션
  (p) => p.endsWith('/play'),
  // Dictation 세션
  (p) => p === '/dictate/session',
  // (app) 풀스크린 라우트 그룹
  (p) => p === '/play' || p.startsWith('/play/'),
  // WordVault Browse 세션 (v06.21.6) — 워크스페이스 접근 용이성
  (p) => p === '/wordvault/browse',
]

export function isFullScreenRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return FULL_SCREEN_PATTERNS.some((match) => match(pathname))
}
