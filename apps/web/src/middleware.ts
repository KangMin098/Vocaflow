// apps/web/src/middleware.ts
// Next.js 미들웨어 — Supabase 세션 갱신 + /admin/* RBAC 가드.
//
// /admin 경로 진입 시:
//   1) 미인증 → /login redirect
//   2) user_profiles.role !== 'admin' → /hub redirect
//   3) admin → 통과

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@vocaflow/types'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  // 세션 갱신 (모든 요청)
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

  const { data: { user } } = await supabase.auth.getUser()

  // 리다이렉트 응답에도 getUser 가 갱신/회전시킨 세션 쿠키를 반드시 실어 보낸다.
  //   (누락 시 토큰 회전이 리다이렉트와 겹치면 새 쿠키 유실 → 옛 refresh 토큰 무효 →
  //    세션이 끊겨 "갑자기 로그아웃" 발생. Supabase SSR 미들웨어 필수 패턴.)
  const redirectTo = (pathname: string, addNext = false): NextResponse => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    if (addNext) url.searchParams.set('next', request.nextUrl.pathname)
    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  // /admin/* 가드
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return redirectTo('/login', true)
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return redirectTo('/hub')
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
