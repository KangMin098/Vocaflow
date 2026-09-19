// apps/web/src/lib/auth/require-admin-api.ts
// API Route 전용 admin/curator 검증.
//
// 차이점 (vs require-admin.ts):
// - require-admin.ts: RSC 전용. 미통과 시 redirect()
// - require-admin-api.ts: API Route 전용. 미통과 시 NextResponse 반환
//
// v06.140: 역할·상태 판정을 lib/auth/account.ts 로 통일 + 정지 계정 403 추가.

import { NextResponse } from 'next/server';

import { canAccessAdminConsole, isUsableAccount } from '@/lib/auth/account';
import { devAdminBypass } from '@/lib/auth/dev-bypass';
import { createClient } from '@/lib/supabase/server';
import type { AdminRole, AdminUser } from '@/lib/auth/types';

export type { AdminRole, AdminUser };

/**
 * API Route entry에서 호출.
 * - 미인증        → NextResponse 401
 * - 정지·해지 계정 → NextResponse 403
 * - role 부적합    → NextResponse 403
 * - 통과          → AdminUser 반환
 *
 * @example
 *   const admin = await requireAdminApi();
 *   if (admin instanceof NextResponse) return admin;
 */
export async function requireAdminApi(): Promise<AdminUser | NextResponse> {
  // 개발 전용 우회 (DEV_ADMIN_BYPASS=1, 프로덕션 무효)
  const bypass = devAdminBypass();
  if (bypass) return bypass;

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
    .select('role, status')
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

  const { role, status } = profile as { role: string | null; status: string | null };

  if (!isUsableAccount(status)) {
    return NextResponse.json(
      { error: 'Forbidden', message: '이용이 정지된 계정입니다.' },
      { status: 403 },
    );
  }

  if (!canAccessAdminConsole(role)) {
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
