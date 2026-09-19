// apps/web/src/lib/auth/redirect.ts
//
// 로그인 후 복귀 경로(return-to) 단일 소스.
//
// 왜 이 파일이 필요했나 (v06.140 실측):
//   복귀 파라미터 이름이 코드베이스에 3종 공존했다.
//     - middleware.ts            → ?next=
//     - wordvault/* · Comic · Vocab → ?next=
//     - require-admin.ts         → ?redirect=
//     - login/page.tsx 이 읽는 것 → ?returnTo=   ← 아무도 쓰지 않는 이름
//   즉 **모든 딥링크 복귀가 조용히 /hub 로 떨어졌다**. 이름을 각자 정하게 두면
//   재발하므로, 쓰기(WRITE)는 한 개로 고정하고 읽기(READ)는 과거 이름까지 흡수한다.
//
// open redirect 방지는 safeInternalPath() 한 곳에서만 판단한다.

/** 복귀 경로를 기록할 때 쓰는 유일한 파라미터 이름. */
export const RETURN_PARAM = 'next'

/**
 * 복귀 경로를 읽을 때 허용하는 파라미터 이름 (하위 호환).
 * 새 코드는 RETURN_PARAM 만 쓰되, 이미 발행된 링크·북마크가 깨지지 않도록 계속 읽는다.
 */
export const RETURN_PARAM_ALIASES = ['next', 'returnTo', 'redirect'] as const

/** 로그인 후 갈 곳이 없을 때의 기본 목적지. */
export const DEFAULT_LANDING = '/hub'

/**
 * 복귀 대상이 될 수 없는 경로 — 인증 화면으로 되돌아가면 로그인 직후 무한 왕복이 된다.
 * (`/login?next=/login` 같은 자기참조 루프 차단)
 */
// ⚠️ 끝에 '/' 를 붙이지 말 것 — 아래 비교가 `=== p || startsWith(p + '/')` 이므로
//    '/api/' 로 적으면 '/api/auth/callback' 이 어느 쪽에도 걸리지 않는다 (실측 회귀).
const NON_RETURNABLE_PREFIXES = ['/login', '/signup', '/reset-password', '/verify-email', '/api']

/** 경로 길이 상한 — 비정상적으로 긴 값은 주입 시도로 보고 버린다. */
const MAX_PATH_LENGTH = 2048

/**
 * 외부로 나가지 않는 내부 경로인지 검증한다.
 *
 * 차단 대상:
 *   - `//evil.com`      protocol-relative URL (브라우저가 외부로 해석)
 *   - `/\evil.com`      백슬래시 — 브라우저가 `/` 로 정규화 → protocol-relative 와 동일
 *   - `https://evil.com`, `/x://y`  스킴 포함
 *   - 제어문자·공백 (`/\n//evil.com` 류 헤더/파서 혼동 유발)
 *   - 인증 화면 자기참조 (로그인 직후 무한 왕복)
 *
 * @param raw 검증할 값 (쿼리에서 읽은 그대로)
 * @returns 안전하면 그 경로, 아니면 null
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null

  const value = raw.trim()
  if (!value || value.length > MAX_PATH_LENGTH) return null

  // 제어문자·공백이 하나라도 있으면 거부 (정상 경로엔 존재하지 않는다)
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007F]/.test(value)) return null

  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('\\')) return null
  if (value.includes('://')) return null

  // 경로 부분만 떼어 인증 화면 자기참조 여부 판단 (쿼리·해시 제외)
  const pathOnly = value.split(/[?#]/)[0]
  if (NON_RETURNABLE_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))) {
    return null
  }

  return value
}

/**
 * 쿼리에서 복귀 경로를 읽는다 — 별칭 3종을 모두 훑고, 안전한 첫 값을 쓴다.
 *
 * @param params URLSearchParams 또는 그와 같은 `get()` 을 가진 객체
 * @param fallback 안전한 값이 없을 때 반환할 경로
 */
export function resolveReturnTo(
  params: Pick<URLSearchParams, 'get'> | null | undefined,
  fallback: string = DEFAULT_LANDING,
): string {
  if (!params) return fallback
  for (const key of RETURN_PARAM_ALIASES) {
    const safe = safeInternalPath(params.get(key))
    if (safe) return safe
  }
  return fallback
}

/**
 * 로그인으로 보내면서 복귀 경로를 실어 준다.
 *
 * @param returnTo 로그인 후 돌아갈 경로 (안전하지 않으면 파라미터를 생략)
 * @param base 로그인 경로 (기본 '/login')
 *
 * @example
 *   loginUrlWithReturn('/wordvault/browse')  // '/login?next=%2Fwordvault%2Fbrowse'
 */
export function loginUrlWithReturn(returnTo: string | null | undefined, base = '/login'): string {
  const safe = safeInternalPath(returnTo)
  return safe ? `${base}?${RETURN_PARAM}=${encodeURIComponent(safe)}` : base
}
