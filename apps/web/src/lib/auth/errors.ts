// apps/web/src/lib/auth/errors.ts
//
// Supabase 인증 에러 → 사용자에게 보여줄 한국어 메시지 단일 매핑.
//
// 원칙:
//   - 계정 존재 여부를 드러내지 않는다 (user enumeration 방지). 로그인 실패는
//     "없는 계정" 과 "틀린 비밀번호" 를 구분하지 않고 같은 문구를 쓴다.
//   - 원본 영어 메시지를 그대로 토스트에 흘리지 않는다 (내부 구조 노출 + 비-한국어 UX).
//   - Empathetic Feedback (철학 3) — 비난 대신 다음 행동을 알려준다.

/** 인증 화면이 배너로 띄우는 표준 폴백. */
const GENERIC_LOGIN = '로그인 중 오류가 발생했습니다. 다시 시도해주세요'

function lower(message: string | undefined | null): string {
  return (message ?? '').toLowerCase()
}

/**
 * 로그인(signInWithPassword) 실패 → 한국어.
 *
 * ⚠️ 'user not found' 를 별도 문구로 노출하지 않는다 — 이메일 가입 여부가 새어
 *    계정 열거(enumeration)에 쓰인다. 자격증명 계열은 전부 같은 문장으로 수렴시킨다.
 */
export function mapAuthError(message: string | undefined | null): string {
  const msg = lower(message)
  if (
    msg.includes('invalid login') ||
    msg.includes('invalid_credentials') ||
    msg.includes('invalid credentials') ||
    msg.includes('user not found')
  ) {
    return '이메일 또는 비밀번호가 일치하지 않습니다'
  }
  if (msg.includes('email not confirmed')) {
    return '이메일 인증이 필요합니다. 받은편지함을 확인하세요'
  }
  if (msg.includes('too many requests') || msg.includes('rate limit') || msg.includes('over_request')) {
    return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }
  return GENERIC_LOGIN
}

/** 정지·삭제된 계정에 쓰는 문구 (자격증명은 맞지만 이용할 수 없는 상태). */
export const SUSPENDED_MESSAGE = '이용이 정지된 계정입니다. 고객센터(support@vocaflow.com)로 문의해주세요'
export const DELETED_MESSAGE = '해지된 계정입니다. 새로 가입하시거나 고객센터로 문의해주세요'

/** 회원가입(signUp) 실패 → 한국어. */
export function mapSignupError(message: string | undefined | null): string {
  const msg = lower(message)

  if (msg.includes('already registered') || msg.includes('user already')) {
    return '이미 가입된 이메일입니다'
  }
  if (msg.includes('password should be') || msg.includes('password is too') || msg.includes('weak password')) {
    return '비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다'
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return '올바른 이메일 형식이 아닙니다'
  }
  if (msg.includes('email rate limit')) {
    return '이메일 발송 한도에 도달했습니다. 약 1시간 후 다시 시도하거나 다른 이메일을 사용해주세요'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('database error') || msg.includes('saving new user')) {
    return '서버 설정 오류 — 관리자에게 문의해주세요 (DB 트리거 미적용 가능성)'
  }
  if (msg.includes('email signups are disabled') || msg.includes('email auth is disabled')) {
    return '이메일 가입이 비활성화되어 있습니다 (관리자 설정 확인 필요)'
  }
  if (msg.includes('signups not allowed') || msg.includes('disabled')) {
    return '회원가입이 일시 중단되었습니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }
  return '회원가입 중 오류가 발생했습니다. 다시 시도해주세요'
}

/** 비밀번호 재설정 메일 발송 실패 → 한국어. */
export function mapResetRequestError(message: string | undefined | null, status?: number): string {
  const msg = lower(message)
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return '올바른 이메일 형식이 아닙니다'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }
  return '재설정 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요'
}

/** 새 비밀번호 저장(updateUser) 실패 → 한국어. */
export function mapPasswordUpdateError(message: string | undefined | null): string {
  const msg = lower(message)
  if (msg.includes('different from the old')) {
    return '이전과 다른 비밀번호를 사용해주세요'
  }
  if (msg.includes('password should be') || msg.includes('weak password')) {
    return '비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다'
  }
  // 세션이 없거나 만료된 상태에서 저장을 시도한 경우
  if (
    msg.includes('session') ||
    msg.includes('jwt') ||
    msg.includes('not authenticated') ||
    msg.includes('auth session missing')
  ) {
    return '재설정 링크가 만료되었습니다. 메일을 다시 요청해주세요'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }
  return '비밀번호 변경에 실패했습니다. 다시 시도해주세요'
}

/** 인증 메일 재발송(resend) 실패 → 한국어. */
export function mapResendError(message: string | undefined | null): string {
  const msg = lower(message)
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('for security purposes')) {
    return '너무 많은 요청입니다. 잠시 후 다시 시도해주세요'
  }
  if (msg.includes('already confirmed') || msg.includes('already been confirmed')) {
    return '이미 인증이 완료된 계정입니다. 로그인해주세요'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return '네트워크 연결을 확인해주세요'
  }
  return '재발송 중 오류가 발생했어요. 잠시 후 다시 시도해주세요'
}

// ══════════════════════════════════════════════════════════════
// 콜백 라우트 ↔ 로그인 화면 사이의 에러 코드 계약
// ══════════════════════════════════════════════════════════════

/** /api/auth/callback 이 /login?error=<code> 로 넘길 수 있는 코드 전체. */
export const CALLBACK_ERROR_CODES = [
  'oauth_failed',
  'email_verification_failed',
  'link_expired',
  'invalid_callback',
  'already_verified',
  'access_denied',
] as const

export type CallbackErrorCode = (typeof CALLBACK_ERROR_CODES)[number]

/** 로그인 화면이 ?error=... 를 배너 문구로 바꾼다. 모르는 코드는 null (배너 미표시). */
export function mapCallbackError(code: string | null | undefined): string | null {
  switch (code) {
    case 'oauth_failed':
      return '소셜 로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요'
    case 'email_verification_failed':
      return '이메일 인증에 실패했습니다. 인증 메일을 다시 받으시거나 고객센터에 문의해주세요'
    case 'link_expired':
      return '인증 링크가 만료되었습니다. 새 인증 메일을 요청해주세요'
    case 'invalid_callback':
      return '잘못된 접근입니다'
    case 'already_verified':
      return '이미 인증이 완료된 계정입니다. 로그인해주세요'
    case 'access_denied':
      return '인증이 취소되었거나 링크가 더 이상 유효하지 않습니다. 다시 시도해주세요'
    default:
      return null
  }
}

/**
 * verifyOtp / exchangeCodeForSession 이 돌려준 에러 메시지를 콜백 에러 코드로 분류한다.
 *
 * @param message Supabase 원본 메시지
 * @param fallback 어느 분류에도 안 맞을 때 쓸 코드
 */
export function classifyCallbackError(
  message: string | undefined | null,
  fallback: CallbackErrorCode = 'email_verification_failed',
): CallbackErrorCode {
  const msg = lower(message)
  if (msg.includes('expired') || msg.includes('expir')) return 'link_expired'
  if (msg.includes('already') && (msg.includes('confirmed') || msg.includes('verified'))) {
    return 'already_verified'
  }
  return fallback
}

/**
 * Supabase 가 콜백 URL 에 직접 실어 보내는 실패 파라미터를 코드로 옮긴다.
 *
 * 예: `?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
 * 이 케이스는 token_hash·code 가 아예 없어 예전엔 'invalid_callback'("잘못된 접근입니다") 으로
 * 떨어졌다 — 만료된 링크를 누른 사용자에게 완전히 틀린 안내였다.
 *
 * @returns 해당 파라미터가 없으면 null
 */
export function classifyProviderError(
  error: string | null | undefined,
  errorCode?: string | null,
  errorDescription?: string | null,
): CallbackErrorCode | null {
  if (!error && !errorCode) return null

  const blob = `${lower(error)} ${lower(errorCode)} ${lower(errorDescription)}`
  if (blob.includes('expired') || blob.includes('otp_expired')) return 'link_expired'
  if (blob.includes('already') && (blob.includes('confirmed') || blob.includes('verified'))) {
    return 'already_verified'
  }
  if (blob.includes('access_denied')) return 'access_denied'
  return 'email_verification_failed'
}
