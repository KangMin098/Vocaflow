// apps/web/src/lib/supabase/server.ts
//
// Supabase 서버 클라이언트 — Server Components / Route Handlers / Server Actions 전용.
//
// 사용처:
//   - 'use client' 가 없는 React Server Component
//   - app/api/**/route.ts (Route Handler)
//   - 'use server' Server Action
//
// 사용 금지:
//   - Client Component → ./client.ts
//   - Edge middleware → ./middleware.ts
//
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// ⚠️ SUPABASE_SERVICE_ROLE_KEY 는 별도 admin 클라이언트에서만 사용 (Phase 2).

import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@vocaflow/types'

/**
 * 서버용 Supabase 클라이언트를 생성합니다.
 *
 * Next.js 15 부터 `cookies()` 가 Promise 를 반환하므로 본 함수도 async.
 * 반환된 클라이언트는 RLS 정책을 그대로 따르며 (anon key 사용),
 * `auth.uid()` 는 사용자 세션 쿠키에서 자동 추출됩니다.
 *
 * @example
 *   // app/dashboard/page.tsx (Server Component)
 *   import { createClient } from '@/lib/supabase/server'
 *
 *   export default async function DashboardPage() {
 *     const supabase = await createClient()
 *     const { data } = await supabase.from('user_stats').select().single()
 *     return <Dashboard stats={data} />
 *   }
 *
 * @returns Database 타입 안전 SupabaseClient (서버 쿠키 동기화)
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component 에서 setAll 호출 시 read-only 라 throw 됨 — 무시.
            // 세션 쿠키 갱신은 middleware (./middleware.ts) 가 담당.
          }
        },
      },
    },
  )
}
