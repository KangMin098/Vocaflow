// apps/web/src/middleware.ts
// Next.js 미들웨어 — Supabase 세션 갱신 + 계정 상태 게이트 + /admin/* RBAC 가드.
//
// v06.140 수정 3건:
//   1) 복귀 파라미터를 ?next= 로 고정하고 **쿼리스트링까지** 싣는다.
//      (로그인 화면은 ?returnTo= 를 읽고 있어 예전엔 복귀가 전부 /hub 로 떨어졌다.
//       이름 계약은 lib/auth/redirect.ts 가 단독 소유한다.)
//   2) /admin 통과 역할을 admin|curator 로 맞춘다.
//      미들웨어만 role==='admin' 을 요구해서 **curator 는 어떤 admin 화면에도
//      들어갈 수 없었다** — RSC 가드(requireAdmin)는 curator 를 허용하는데 그 앞에서 막혔다.
//   3) user_profiles.status 게이트 추가.
//      정지·해지 계정을 검사하는 코드가 어디에도 없어, 정지시켜도 그대로 전 기능을 썼다.

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@vocaflow/types'

import { blockedReasonCode, canAccessAdminConsole, isUsableAccount } from '@/lib/auth/account'
import { loadAccountProfile } from '@/lib/auth/profile-cache'
import { requiresAuth } from '@/lib/auth/protected-routes'
import { RETURN_PARAM, safeInternalPath } from '@/lib/auth/redirect'
import { devAdminBypass } from '@/lib/auth/dev-bypass'

/**
 * 계정 상태 조회를 건너뛰는 경로 — 공개 화면과 인증 화면.
 * (여기서 정지 검사를 하면 정지 사용자가 로그인 화면조차 못 열어 무한 리다이렉트가 된다.)
 */
const STATUS_CHECK_SKIP_PREFIXES = [
  '/login',
  '/signup',
  '/reset-password',
  '/verify-email',
  '/api/auth',
  '/terms',
  '/privacy',
  '/about',
  '/pricing',
]

function skipsStatusCheck(pathname: string): boolean {
  if (pathname === '/') return true
  return STATUS_CHECK_SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 리다이렉트 응답에도 getUser 가 갱신/회전시킨 세션 쿠키를 반드시 실어 보낸다.
  //   (누락 시 토큰 회전이 리다이렉트와 겹치면 새 쿠키 유실 → 옛 refresh 토큰 무효 →
  //    세션이 끊겨 "갑자기 로그아웃" 발생. Supabase SSR 미들웨어 필수 패턴.)
  const redirectTo = (pathname: string, params?: Record<string, string>): NextResponse => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)
    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  /** 현재 요청 경로 + 쿼리 — 로그인 후 여기로 되돌린다. */
  const currentPath =
    safeInternalPath(`${request.nextUrl.pathname}${request.nextUrl.search}`) ?? null

  const pathname = request.nextUrl.pathname
  const isAdminRoute = pathname.startsWith('/admin')

  // ── 로그인한 사람에게 `/` 는 랜딩이 아니다 ─────────────────────────────
  // 랜딩은 검색이 도착하는 정문이라 **익명에게 맞춰** 만들어졌다(가입 CTA · 무료 근거 · 소개).
  // 로그인한 사람이 주소만 치고 들어오면 그 화면은 이미 내린 결정을 다시 묻는다.
  //
  // 페이지 안에서 세션을 읽어 갈라 놓지 않는 이유: `/` 는 `revalidate = 86400` 인 ISR 이라
  // 페이지가 auth 를 조회하는 순간 **캐시가 깨져** 크롤러가 받는 화면까지 매 요청 렌더된다.
  // 미들웨어는 캐시 앞에서 돌기 때문에 익명 요청은 그대로 캐시된 랜딩을 받는다.
  // 세션 조회(getUser)는 위에서 이미 했으니 왕복이 늘지도 않는다.
  //
  // ⚠️ 이 리다이렉트를 먼저 넣었으면 **모바일에서 `/teacher` 로 가는 마지막 길이 끊겼다** —
  //    랜딩 CTA 가 그때까지 유일한 통로였다. `MobileUtilityBar` 가 생긴 뒤에야 안전하다.
  if (user && pathname === '/') return redirectTo('/hub')

  // 개발 전용 우회 (DEV_ADMIN_BYPASS=1, 프로덕션 무효) — 상태·역할 검사 생략
  if (isAdminRoute && devAdminBypass()) {
    return response
  }

  // ── 프로필 1회 조회로 상태·역할을 함께 판정 (admin 경로는 어차피 필요했다) ──
  const needsProfile = !!user && (isAdminRoute || !skipsStatusCheck(pathname))

  let profileRole: string | null = null
  let profileStatus: string | null = null

  if (needsProfile) {
    // ── 요청마다 다시 읽지 않는다 (2026-09-06 장애, 발견 #43) ──────────
    // 36분에 프로필 조회 **3,482건**이 여기서 나갔고 그것이 읽기 포화의 단일 최대
    // 기여자였다. 역할·상태는 요청마다 바뀌는 값이 아니다 — 겹치는 요청은 합치고
    // 짧은 TTL 안에서는 다시 쓴다. 무엇이 늦어지는지는 `profile-cache.ts` 머리말에 적혀 있다.
    //
    // ⚠️ **조회 실패를 "프로필 없음" 으로 뭉개지 않는다.** 예전에는 error 를 버리고
    //   data 만 봐서 둘이 같은 결과(role/status = null)로 떨어졌다. 그대로 캐시하면
    //   순간적 오류가 TTL 동안 굳어 관리자를 비관리자로 만든다.
    const result = await loadAccountProfile(user!.id, async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, status')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) return { ok: false as const }
      const row = data as { role?: string | null; status?: string | null } | null
      return { ok: true as const, profile: row ? { role: row.role ?? null, status: row.status ?? null } : null }
    })

    // 못 읽었으면 **막지도 통과시키지도 않는다** — 예전과 같은 자리에 선다
    // (역할 없음 → /admin 은 막히고, 상태 없음 → 정지로 오인해 내쫓지 않는다).
    profileRole = result.ok ? (result.profile?.role ?? null) : null
    profileStatus = result.ok ? (result.profile?.status ?? null) : null

    // 정지·해지 계정은 세션을 끊고 사유와 함께 로그인 화면으로
    if (result.ok && !isUsableAccount(profileStatus)) {
      await supabase.auth.signOut()
      return redirectTo('/login', { error: blockedReasonCode(profileStatus) ?? 'suspended' })
    }
  }

  const toLogin = () =>
    redirectTo('/login', currentPath ? { [RETURN_PARAM]: currentPath } : undefined)

  // ── /admin/* 가드 ──
  if (isAdminRoute) {
    if (!user) return toLogin()
    if (!canAccessAdminConsole(profileRole)) {
      return redirectTo('/hub')
    }
    return response
  }

  // ── 개인 화면 가드 (lib/auth/protected-routes.ts 가 목록의 단독 소유자) ──
  // 예전엔 페이지마다 손으로 붙인 getUser→redirect 뿐이라 48 중 32 라우트가 열려 있었다.
  // 도서·만화 카탈로그는 공개로 남긴다 (발견·SEO).
  if (!user && requiresAuth(pathname)) {
    return toLogin()
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
