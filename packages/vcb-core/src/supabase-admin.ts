// packages/vcb-core/src/supabase-admin.ts
// Supabase admin client (service_role key 사용). Node 환경 전용.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentError } from './errors';

let cachedClient: SupabaseClient | null = null;

/**
 * VCB CLI/admin server 전용 Supabase 클라이언트.
 * service_role key 를 사용하므로 RLS 우회 가능.
 * 브라우저/클라이언트 번들에 절대 포함 금지.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new EnvironmentError(
      'getSupabaseAdmin() must not be called in browser context',
      { hint: 'service_role key exposure risk' }
    );
  }

  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new EnvironmentError(
      'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set'
    );
  }
  if (!serviceRoleKey) {
    throw new EnvironmentError('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  return cachedClient;
}

/**
 * 테스트용 캐시 리셋.
 */
export function resetSupabaseAdminCache(): void {
  cachedClient = null;
}
