// apps/web/middleware.ts
//
// Edge middleware — 라우트 가드 + Supabase 세션 갱신.
//
// 정책 (CLAUDE.md §17.10 IA + 본 마이그레이션):
//   1) Public            (/, /about, /pricing, /terms, /privacy, /library/*)
//      → 인증 무관 진입 허용
//   2) Auth pages        (/login, /signup, /reset-password, /verify-email)
//      → 비로그인: 진입 허용 / 이미 로그인: /hub 자동 이동
//   3) Protected         (/hub, /text*, /wordvault*, 학습 모듈*, /dashboard, /settings)
//      → 비로그인: /login?returnTo=<path> / 로그인: 진입 허용
//   4) Admin             (/admin, /admin/*)
//      → 비로그인: /login?returnTo=<path>
//      → 로그인 + role!=admin: /hub
//      → 로그인 + role=admin: 진입 허용
//
// 무한 리다이렉트 방지:
//   - matcher 에서 _next/* · favicon · 정적 자산 · /api/auth/callback 제외
//   - 리다이렉트 대상 (/login, /hub) 자체는 가드에서 통과 처리
//   - role 조회 실패 시 안전 fallback (/hub) — admin 페이지 절대 노출 X
//
// updateSession 헬퍼 (./src/lib/supabase/middleware.ts) 와의 관계:
//   - 헬퍼는 단일 책임 (세션 쿠키 갱신만)
//   - 본 파일은 동일 패턴을 inline 으로 통합 — getUser() 결과를 가드 분기에도 사용해야
//     하므로 헬퍼 호출 후 별도 client 재생성을 피하기 위함 (성능·일관성)

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { isAdmin, type Database } from '@vocaflow/types'

// ────────────────────────────────────────────────────────────
// 라우트 분류
// ────────────────────────────────────────────────────────────
//
// Public 경로 (정확/Prefix) — 분기 4 fall-through 로 처리:
//   - 정확: /, /about, /pricing, /terms, /privacy
//   - Prefix: /library/*  (탐색은 자유 · 액션 가드는 클라이언트)
//   - 기타: /api/* (callback 제외 — 자체 RLS 보호) · /dev/*

/** 비로그인 사용자 진입점 — 이미 로그인된 사용자는 /hub 으로 자동 이동 */
const AUTH_PREFIX = ['/login', '/signup', '/reset-password', '/verify-email']

/** 인증 필수 prefix (로그인 후 앱 영역) */
const PROTECTED_PREFIX = [
  '/hub',
  '/text',
  '/wordvault',
  '/flashcard',
  '/spellforge',
  '/wordblitz',
  '/play',
  '/scriptquiz',
  '/dictate',
  '/pairflip',
  '/dashboard',
  '/settings',
]

/** 관리자 전용 — 인증 + role='admin' 필수 */
const ADMIN_PREFIX = '/admin'

function matchPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isAuthPath(pathname: string): boolean {
  return matchPrefix(pathname, AUTH_PREFIX)
}

function isProtectedPath(pathname: string): boolean {
  return matchPrefix(pathname, PROTECTED_PREFIX)
}

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)
}

// ────────────────────────────────────────────────────────────
// 헬퍼 — 안전한 redirect 생성 (search 보존 옵션)
// ────────────────────────────────────────────────────────────
function redirectTo(request: NextRequest, pathname: string, search = ''): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = search
  return NextResponse.redirect(url)
}

// ────────────────────────────────────────────────────────────
// middleware
// ────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Supabase 클라이언트 + 세션 쿠키 갱신 ──
  // (updateSession 헬퍼와 동일 패턴 — 본 파일은 결과 user 를 가드에 사용)
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // 토큰 자동 refresh + 사용자 식별
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 분기 1: Auth 페이지 ──
  // 이미 로그인된 사용자는 /hub 으로 자동 이동 (무한 리다이렉트 방지를 위해
  // /hub 자체는 PROTECTED 라 user 가 있으면 통과)
  if (isAuthPath(pathname)) {
    if (user) {
      return redirectTo(request, '/hub')
    }
    return response
  }

  // ── 분기 2: Admin 라우트 (인증 + role='admin') ──
  if (isAdminPath(pathname)) {
    if (!user) {
      // 비로그인 → /login?returnTo=...
      return redirectTo(
        request,
        '/login',
        `?returnTo=${encodeURIComponent(pathname)}`,
      )
    }

    // role 조회 — 실패 시 안전 fallback (/hub) 으로 admin 노출 차단
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      // 조회 실패 / 프로필 없음 / 권한 부족 → /hub
      if (error || !profile || !isAdmin(profile.role)) {
        return redirectTo(request, '/hub')
      }
    } catch {
      // 예외 시에도 안전 fallback (middleware 안에서 throw 금지 — 전체 앱 다운 방지)
      return redirectTo(request, '/hub')
    }

    return response
  }

  // ── 분기 3: Protected 라우트 (인증 필요) ──
  if (isProtectedPath(pathname)) {
    if (!user) {
      return redirectTo(
        request,
        '/login',
        `?returnTo=${encodeURIComponent(pathname)}`,
      )
    }
    return response
  }

  // ── 분기 4: Public 등 fall-through ──
  // PUBLIC_EXACT (/, /about, /pricing, /terms, /privacy)
  //   · PUBLIC_PREFIX (/library/*)
  //   · /api/* (callback 외 — 일반 API 는 자체 RLS 로 보호)
  //   · /dev/* (개발 카탈로그)
  // 모두 인증 무관 통과. 세션 쿠키만 갱신된 response 반환.
  return response
}

// ────────────────────────────────────────────────────────────
// matcher — 미들웨어 적용 범위
// ────────────────────────────────────────────────────────────
//
// 제외:
//   - /_next/static · /_next/image  (Next.js 정적 빌드 자산)
//   - /favicon.ico                  (브라우저 자동 요청)
//   - /api/auth/callback            (Supabase OAuth 콜백 — 가드 절대 X)
//   - 정적 이미지 확장자             (.svg/.png/.jpg/.jpeg/.gif/.webp)
//
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
