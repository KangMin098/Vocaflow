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
// 정책 (2026-08-14 사용자 확정 · 2026-08-17 보강):
//   - 보호: 계정·진도·개인 학습·관리 화면 + **쓰기가 일어나는 세션**(`/play`)
//   - 공개: 랜딩/약관 + 도서(`/library`)·만화(`/comics`) 카탈로그 + **Game Lab 카탈로그**(`/arcade`)
//           — 둘러보기는 열어 둔다 (발견·SEO·무가입 유입)
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
  // 진입면 재설계 랩 — 실학습 데이터를 그대로 렌더하므로 /hub 과 같은 보호가 필요하다.
  // ('/hub' 접두사는 정확일치 또는 '/hub/…' 만 잡으므로 '/hub-lab' 은 여기 없으면 공개된다.)
  '/hub-lab',
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
  // ⚠️ `/arcade`(Game Lab **카탈로그**)는 여기 없다 — 일부러 공개다. 아래 §Game Lab 참조.
  //    실제 플레이(`/play/*`)는 FSRS·scores 를 쓰므로 보호한다.
  '/play',
  // 기출 유형 분석 — 우리가 쓴 분석문이다(평가원 지문 원문은 싣지 않는다).
  // 공개해도 저작권 문제는 없지만 `csat_type_reports` 의 RLS 가 authenticated 만 열어 두었으므로
  // 지금 공개하면 **빈 화면이 공개 표면이 된다.** 공개로 돌리려면 RLS 정책부터 고칠 것.
  '/csat',
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
  // 지문 난이도 진단 — 가입 전에 가치를 보여주는 관문(공개가 존재 이유다).
  //   10만 경로가 교사 채널(CAC 0)이라, 교사가 로그인 없이 써볼 수 있어야 채널이 성립한다.
  //   개인 데이터를 읽지도 쓰지도 않는다 — 공개 어휘 테이블만 조회한다.
  '/fit',
  // §Game Lab **카탈로그** — `/fit` 과 같은 이유로 공개. 플레이(`/play/*`)는 보호된다.
  //
  //   2026-08-15 인증 스윕(`e9970450`)이 `(main)` 48 라우트 중 32개의 **사고로 열린** 노출을
  //   닫으면서 `/arcade` 도 함께 잠갔다. 그 커밋의 목적은 권한 상승 차단이었고 `/library`·
  //   `/comics` 는 공개로 예외 처리했는데 `/arcade` 는 **논의된 흔적이 없다** — 휩쓸린 쪽이다.
  //   반면 비로그인 아케이드는 **일부러 만들어져 있다**: 맛보기 배지 · "단어 모으러 가기" CTA ·
  //   무단어 오늘의 실험(`pickDailyGame`) · 회귀 스펙 헤더가 그 그룹을 **"신규 유입 경로"** 로
  //   명시한다(`tests/e2e/09-arcade-access.spec.ts`). 아무도 닿을 수 없는 페이지에 그걸 짓지 않는다.
  //   그 사이 그 스펙 7건이 계속 빨간 채였다(실측 2026-08-17 — 잠긴 뒤 아무도 안 봤다는 뜻이다).
  //
  //   개인 데이터를 노출하지 않는다: bank 게임은 내장 큐레이션 뱅크를 쓰고, mine 게임은
  //   스코프가 없으면 맛보기로 떨어지며, 점수 기록은 비로그인이면 애초에 저장되지 않는다.
  '/arcade',
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
