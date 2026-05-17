// packages/library-pipeline/src/client.ts
// service_role 권한 Supabase 클라이언트 — admin/CLI/Edge Function 전용

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from './env'

let _client: SupabaseClient | null = null

/**
 * service_role 권한 싱글톤. 사용자 측 코드에서는 절대 import 금지.
 * 단위 테스트에서 별도 client 가 필요하면 createClient 직접 호출.
 */
export function getServiceClient(): SupabaseClient {
  if (_client) return _client
  const env = loadEnv()
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
