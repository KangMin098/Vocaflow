// apps/web/src/lib/supabase/middleware.ts
//
// Edge middleware 용 Supabase 세션 갱신 헬퍼.
//
// 역할:
//   1) request 의 auth 쿠키를 Supabase 클라이언트로 전달 (세션 검증)
//   2) Supabase 가 쿠키 갱신을 요구하면 (e.g. token refresh) response 에 set
//   3) 갱신된 NextResponse 를 반환하여 다음 핸들러 / 페이지에 전달
//
// 사용처:
//   - apps/web/middleware.ts (다음 단계에서 작성 — 라우트 가드 + redirect 로직)
//
// 본 파일은 헬퍼만 정의하며, 실제 라우트별 권한 검증·redirect 는 호출처가 결정.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@vocaflow/types'

/**
 * Edge middleware 에서 호출하여 Supabase 세션을 갱신하고 NextResponse 를 반환합니다.
 *
 * 동작:
 *   - request 쿠키 → Supabase 클라이언트 주입
 *   - `auth.getUser()` 호출로 토큰 자동 refresh 트리거
 *   - 변경된 쿠키는 request·response 양쪽에 동기화
 *
 * @example
 *   // apps/web/middleware.ts (다음 단계)
 *   import { updateSession } from '@/lib/supabase/middleware'
 *
 *   export async function middleware(request: NextRequest) {
 *     return await updateSession(request)
 *   }
 *
 *   export const config = {
 *     matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
 *   }
 *
 * @param request 원본 NextRequest
 * @returns 쿠키가 동기화된 NextResponse (호출처에서 추가 가공 가능)
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
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
          // request 와 response 양쪽 모두에 쿠키 set
          //  - request: 후속 헤더 처리에서 최신 쿠키 보이도록
          //  - response: 브라우저로 전달
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

  // 토큰 자동 refresh 트리거 — Supabase 가 만료 임박 시 새 쿠키 발급.
  // 결과 자체는 본 파일에서 사용하지 않음 (라우트 가드는 호출처 책임).
  await supabase.auth.getUser()

  return response
}
