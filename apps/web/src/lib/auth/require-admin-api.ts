// apps/web/src/lib/auth/require-admin-api.ts
// LCP v2.0 Phase 12 묶음 B — API Route 전용 admin/curator role check
//
// 차이점 (vs require-admin.ts):
// - require-admin.ts: RSC 전용. 미통과 시 redirect()
// - require-admin-api.ts: API Route 전용. 미통과 시 NextResponse 반환

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type AdminRole = 'admin' | 'curator';

export interface AdminUser {
  id: string;
  email: string | null;
  role: AdminRole;
}

/**
 * API Route entry에서 호출.
 * - 미인증 → NextResponse 401
 * - role 부적합 → NextResponse 403
 * - 통과 → AdminUser 반환
 */
export async function requireAdminApi(): Promise<AdminUser | NextResponse> {
  const client = await createClient();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: '로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[requireAdminApi] user_profiles fetch failed:', profileError.message);
    return NextResponse.json(
      { error: 'Forbidden', message: '권한 정보를 확인할 수 없습니다.' },
      { status: 403 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: 'Forbidden', message: '관리자 권한이 필요합니다.' },
      { status: 403 },
    );
  }

  const role = (profile as { role: string }).role;
  if (role !== 'admin' && role !== 'curator') {
    return NextResponse.json(
      { error: 'Forbidden', message: '관리자 또는 큐레이터만 접근 가능합니다.' },
      { status: 403 },
    );
  }

  return {
    id: user.id,
    email: user.email ?? null,
    role: role as AdminRole,
  };
}
