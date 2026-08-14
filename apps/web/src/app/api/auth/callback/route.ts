// apps/web/src/app/api/auth/callback/route.ts
//
// Supabase 인증 callback Route Handler — 4가지 진입 케이스 처리.
//
// 1) Supabase 가 실어 보낸 실패 파라미터 (?error=&error_code=&error_description=)
//    예: ?error=access_denied&error_code=otp_expired&error_description=Email+link+...
//    → 만료/취소를 그대로 분류해 /login?error=link_expired 등으로.
//    ⚠️ v06.140 이전엔 이 케이스가 token_hash·code 가 없다는 이유로 Case 4 로 떨어져
//       만료된 링크를 누른 사용자에게 "잘못된 접근입니다" 라고 오안내했다.
//
// 2) token_hash 방식 (이메일 인증 — signup·recovery·email_change·invite)
//    → supabase.auth.verifyOtp({ token_hash, type })
//
// 3) code 방식 (OAuth / PKCE)
//    → supabase.auth.exchangeCodeForSession(code)
//
// 4) 전부 없음 (봇·잘못된 링크) → /login?error=invalid_callback
//
// type 별 다음 목적지:
//   signup       → /hub
//   recovery     → /reset-password?mode=update   (폼이 세션 추측 없이 update 모드로 뜬다)
//   email_change → /settings
//   invite       → /signup?invited=true
//   그 외        → safeInternalPath(next) || /hub
//
// ⚠️ 미들웨어 matcher 에서 /api/auth/callback 은 제외됨 — 절대 가드하지 말 것.
// ⚠️ service_role 키 사용 금지 — verifyOtp/exchangeCodeForSession 은 anon 으로 충분.

import { NextResponse, type NextRequest } from 'next/server'

import { classifyCallbackError, classifyProviderError } from '@/lib/auth/errors'
import { DEFAULT_LANDING, safeInternalPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

type EmailOtpType = 'signup' | 'recovery' | 'email_change' | 'invite'

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ['signup', 'recovery', 'email_change', 'invite']

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return v != null && (EMAIL_OTP_TYPES as readonly string[]).includes(v)
}

/**
 * 이메일 OTP type 별 기본 목적지.
 * next 가 명시된 경우엔 safeInternalPath(next) 가 우선 — 본 함수는 fallback.
 */
function defaultNextForType(type: EmailOtpType): string {
  switch (type) {
    case 'signup':
      return DEFAULT_LANDING
    case 'recovery':
      // ?mode=update 마커로 재설정 폼이 곧장 "새 비밀번호" 모드로 뜬다
      return '/reset-password?mode=update'
    case 'email_change':
      return '/settings'
    case 'invite':
      return '/signup?invited=true'
  }
}

const isDev = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const typeRaw = searchParams.get('type')
  const nextRaw = searchParams.get('next')

  const loginWithError = (errorCode: string) =>
    NextResponse.redirect(`${origin}/login?error=${errorCode}`)

  // ─────────────────────────────────────────────
  // Case 1: Supabase 가 URL 로 직접 넘긴 실패
  // ─────────────────────────────────────────────
  const providerError = classifyProviderError(
    searchParams.get('error'),
    searchParams.get('error_code'),
    searchParams.get('error_description'),
  )
  if (providerError) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('[auth/callback] provider error:', {
        error: searchParams.get('error'),
        error_code: searchParams.get('error_code'),
        mapped: providerError,
      })
    }
    return loginWithError(providerError)
  }

  const supabase = await createClient()

  // ─────────────────────────────────────────────
  // Case 2: token_hash 방식 (이메일 인증)
  // ─────────────────────────────────────────────
  if (tokenHash && isEmailOtpType(typeRaw)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeRaw })

    if (error) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[auth/callback] verifyOtp error:', error.message)
      }
      return loginWithError(classifyCallbackError(error.message))
    }

    // 인증 성공 — next 가 안전하면 우선, 아니면 type 별 기본 목적지
    const target = safeInternalPath(nextRaw) ?? defaultNextForType(typeRaw)
    return NextResponse.redirect(`${origin}${target}`)
  }

  // ─────────────────────────────────────────────
  // Case 3: code 방식 (OAuth / PKCE)
  // ─────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      }
      // 만료/이미처리 여부까지 구분하고, 그 외에는 oauth_failed
      return loginWithError(classifyCallbackError(error.message, 'oauth_failed'))
    }

    // recovery 메일이 PKCE(code) 로 오는 설정에서도 재설정 폼으로 보낸다
    const fallback = isEmailOtpType(typeRaw)
      ? defaultNextForType(typeRaw)
      : DEFAULT_LANDING
    return NextResponse.redirect(`${origin}${safeInternalPath(nextRaw) ?? fallback}`)
  }

  // ─────────────────────────────────────────────
  // Case 4: 잘못된 진입 (아무 파라미터도 없음)
  // ─────────────────────────────────────────────
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] invalid callback — no code or token_hash', {
      type: typeRaw,
      next: nextRaw,
    })
  }
  return loginWithError('invalid_callback')
}
