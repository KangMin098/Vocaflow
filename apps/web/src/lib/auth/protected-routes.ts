// apps/web/src/lib/auth/protected-routes.ts
//
// "로그인이 필요한 화면" 의 단일 선언.
//
// 왜 필요했나 (v06.140 실측):
//   apps/web/CLAUDE.md 는 `(main)` 을 "로그인 후 앱" 으로 정의하는데, 실제로는
//   48 라우트 중 32 개가 로그아웃 상태로 열렸다. 가드가 페이지마다 손으로 붙어 있어
//   (`getUser()` → `redirect('/login…')`) 새 화면을 추가할 때마다 빠졌기 때문이다.
//   → 선언을 한 곳에 모으고 미들웨어가 강제한다. 새 화면은 "기본 보호" 가 아니라
//     **명시적으로 접두사에 속하면 보호** — 공개 카탈로그를 실수로 잠그지 않기 위해서다.
//
// 정책 (2026-08-14 사용자 확정):
//   - 보호: 계정·진도·개인 학습·관리 화면
//   - 공개: 랜딩/약관 + 도서(`/library`)·만화(`/comics`) 카탈로그 둘러보기 (발견·SEO 유지)
//
// ⚠️ `/api/*` 는 여기서 다루지 않는다. API 는 리다이렉트가 아니라 401/403 을 돌려줘야 하고,
//    그 판단은 각 route handler 와 requireAdminApi 가 이미 하고 있다.

/**
 * 로그인이 필요한 경로 접두사.
 * 비교 규칙은 `정확히 일치` 또는 `<접두사>/…` — 끝에 '/' 를 붙이지 말 것.
 * ('/my/' 로 적으면 '/my' 단독이 안 잡히고, '/api/' 실수와 같은 계열의 버그가 난다.)
 */
export const PROTECTED_PREFIXES = [
  // 계정 · 진도 · 리포트
  '/hub',
  '/dashboard',
  '/settings',
  '/reports',
  '/teacher',
  '/plan',
  '/my',
  // 진단 · 처방
  '/diagnostic',
  '/practice',
  // 학습 모듈
  '/wordvault',
  '/flashcard',
  '/spellforge',
  '/pairflip',
  '/wordblitz',
  '/scriptquiz',
  '/dictate',
  '/arcade',
  '/play',
  // 사용자 텍스트 (개인 콘텐츠)
  '/text',
] as const

/**
 * 로그인 없이 열려 있어야 하는 경로 접두사 — 보호 목록보다 우선한다.
 * (보호 접두사 아래에 예외 공개 화면이 생기면 여기에 적는다.)
 */
export const PUBLIC_PREFIXES = [
  '/',
  '/about',
  '/pricing',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/reset-password',
  '/verify-email',
  '/library',
  '/comics',
  '/api',
  '/dev',
] as const

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * 이 경로가 로그인을 요구하는가.
 *
 * @example
 *   requiresAuth('/settings')        // true
 *   requiresAuth('/library/books')   // false — 카탈로그는 공개
 *   requiresAuth('/textbook')        // false — '/text' 의 부분 일치가 아니다
 */
export function requiresAuth(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return false

  // 공개 선언이 항상 우선 (보호 접두사와 겹쳐도 열어 둔다)
  if (PUBLIC_PREFIXES.some((p) => matchesPrefix(pathname, p))) return false

  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))
}
