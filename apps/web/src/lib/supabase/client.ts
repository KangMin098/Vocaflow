// apps/web/src/lib/supabase/client.ts
//
// Supabase 브라우저 클라이언트 — Client Components 전용.
//
// 사용처:
//   - 'use client' 파일 (이벤트 핸들러, hooks, real-time subscriptions)
//   - 브라우저에서만 실행되는 코드
//
// 사용 금지 (다른 파일 사용):
//   - Server Components / Route Handlers / Server Actions → ./server.ts
//   - middleware.ts → ./middleware.ts
//
// 환경변수:
//   - NEXT_PUBLIC_SUPABASE_URL        (브라우저 노출 OK)
//   - NEXT_PUBLIC_SUPABASE_ANON_KEY   (브라우저 노출 OK · RLS 로 보호)
//
// ⚠️ SUPABASE_SERVICE_ROLE_KEY 는 절대 import 금지 (RLS 우회 권한).

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@vocaflow/types'

/**
 * 브라우저용 Supabase 클라이언트를 생성합니다.
 *
 * @example
 *   'use client'
 *   import { createClient } from '@/lib/supabase/client'
 *
 *   export function MyComponent() {
 *     const supabase = createClient()
 *     const { data } = await supabase.from('vocabularies').select()
 *     ...
 *   }
 *
 * @returns Database 타입 안전 SupabaseClient (브라우저 쿠키 동기화)
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
