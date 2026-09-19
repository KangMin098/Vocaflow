// apps/web/src/lib/supabase/admin.ts
//
// 서비스 롤 Supabase 클라이언트 (RLS 우회) — **반드시 admin 게이트(requireAdmin) 뒤에서만** 사용.
//
// 왜 필요한가:
//   RLS-bound createClient()(./server.ts)는 쿠키 세션의 auth.uid()에 의존한다.
//   DEV_ADMIN_BYPASS 환경(로그인 없이 /admin)에선 실제 세션이 없어 auth.uid()=NULL →
//   admin/curator 전용 RLS 정책이 전부 차단 → admin 데이터가 빈 화면으로 보인다.
//   (ACP가 이미 이 이유로 service_role API route 패턴을 채택.)
//
// 사용 규약:
//   const user = await requireAdmin('/admin/...')   // 게이트 + 행위자 id
//   const client = createAdminClient()              // RLS 우회 DB 접근
//   ...decided_by/created_by 는 user.id 를 명시 전달 (service_role 은 세션 없음)
//
// ⚠️ requireAdmin 없이 호출 금지 — RLS 를 통째로 우회하므로 인증 게이트가 유일한 방어선.

import 'server-only'

import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'createAdminClient: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락',
    )
  }
  return createSbClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next 14 는 전역 fetch 를 패치해 서버 측 GET 을 기본 캐시한다. supabase-js 의 조회는
    // 그냥 GET 이라 그 캐시에 걸리고, **admin 화면이 낡은 스냅샷을 계속 보여준다**
    // (실측: 파이프라인이 review·8컷까지 진행됐는데 큐 API 는 직전 failed 상태를 반환).
    // 서비스롤 조회는 항상 최신이어야 하므로 라우트마다 챙기지 말고 여기서 못 박는다.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}
