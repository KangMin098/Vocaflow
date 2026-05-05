// apps/web/src/app/api/auth/callback/route.ts
//
// Supabase 인증 callback Route Handler — 3가지 진입 케이스 처리.
//
// 1) token_hash 방식 (이메일 인증 — Supabase 최신, signup·recovery·email_change·invite)
//    예: /api/auth/callback?token_hash=...&type=signup&next=/hub
//    → supabase.auth.verifyOtp({ token_hash, type })
//
// 2) code 방식 (OAuth — Google·Apple 등)
//    예: /api/auth/callback?code=...&next=/hub
//    → supabase.auth.exchangeCodeForSession(code)
//
// 3) 둘 다 없음 (잘못된 진입 — 봇·잘못된 링크)
//    → /login?error=invalid_callback
//
// type 별 다음 목적지 분기:
//   signup       → /hub                   (인증 완료 후 첫 진입)
//   recovery     → /reset-password        (비밀번호 재설정 폼)
//   email_change → /settings              (이메일 변경 확인)
//   invite       → /signup?invited=true   (초대 가입 흐름)
//   그 외        → safeNext(next) || /hub
//
// ⚠️ 미들웨어 matcher 에서 /api/auth/callback 은 제외됨 — 절대 가드하지 말 것.
// ⚠️ service_role 키 사용 금지 — verifyOtp/exchangeCodeForSession 은 anon 으로 충분.

import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type EmailOtpType = 'signup' | 'recovery' | 'email_change' | 'invite'

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ['signup', 'recovery', 'email_change', 'invite']

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return v != null && (EMAIL_OTP_TYPES as readonly string[]).includes(v)
}

/**
 * next 쿼리 파라미터 안전 검증 — open redirect 방지.
 * 내부 경로만 허용 (`/` 시작, `//` 차단, 외부 URL 차단).
 */
function safeNext(next: string | null): string {
  if (!next) return '/hub'
  if (!next.startsWith('/') || next.startsWith('//')) return '/hub'
  if (next.includes('://') || next.includes('\\')) return '/hub'
  return next
}

/**
 * 이메일 OTP type 별 기본 목적지.
 * next 가 명시된 경우엔 safeNext(next) 가 우선 — 본 함수는 fallback.
 */
function defaultNextForType(type: EmailOtpType): string {
  switch (type) {
    case 'signup':
      return '/hub'
    case 'recovery':
      return '/reset-password'
    case 'email_change':
      return '/settings'
    case 'invite':
      return '/signup?invited=true'
  }
}

/**
 * Supabase 에러 메시지 → 표준화된 에러 코드.
 * 만료/이미 사용/잘못된 토큰 케이스를 분리해 사용자에게 정확한 안내 제공.
 */
function classifyError(message: string | undefined): 'link_expired' | 'already_verified' | 'generic' {
  const msg = (message ?? '').toLowerCase()
  if (msg.includes('expired') || msg.includes('expir')) return 'link_expired'
  if (msg.includes('already') && (msg.includes('confirmed') || msg.includes('verified'))) {
    return 'already_verified'
  }
  return 'generic'
}

const isDev = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const typeRaw = searchParams.get('type')
  const nextRaw = searchParams.get('next')

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[auth/callback] params:', {
      code: code ? `${code.slice(0, 8)}…` : null,
      token_hash: tokenHash ? `${tokenHash.slice(0, 8)}…` : null,
      type: typeRaw,
      next: nextRaw,
    })
  }

  const supabase = await createClient()

  // ─────────────────────────────────────────────
  // Case 1: token_hash 방식 (이메일 인증)
  // ─────────────────────────────────────────────
  if (tokenHash && isEmailOtpType(typeRaw)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeRaw,
    })

    if (error) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[auth/callback] verifyOtp error:', error)
      }
      const kind = classifyError(error.message)
      const errorCode =
        kind === 'link_expired'
          ? 'link_expired'
          : kind === 'already_verified'
            ? 'already_verified'
            : 'email_verification_failed'
      return NextResponse.redirect(`${origin}/login?error=${errorCode}`)
    }

    // 인증 성공 — next 가 있으면 우선, 없으면 type 별 기본 목적지
    const target = nextRaw ? safeNext(nextRaw) : defaultNextForType(typeRaw)
    return NextResponse.redirect(`${origin}${target}`)
  }

  // ─────────────────────────────────────────────
  // Case 2: code 방식 (OAuth)
  // ─────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[auth/callback] exchangeCodeForSession error:', error)
      }
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
    }

    return NextResponse.redirect(`${origin}${safeNext(nextRaw)}`)
  }

  // ─────────────────────────────────────────────
  // Case 3: 잘못된 진입 (token_hash·code 모두 없음)
  // ─────────────────────────────────────────────
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] invalid callback — no code or token_hash', {
      type: typeRaw,
      next: nextRaw,
    })
  }
  return NextResponse.redirect(`${origin}/login?error=invalid_callback`)
}
