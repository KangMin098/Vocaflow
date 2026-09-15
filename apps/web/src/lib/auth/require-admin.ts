// apps/web/src/lib/auth/require-admin.ts
// RSC 전용 admin/curator 검증 유틸리티.
//
// 사용 패턴 (RSC entry point에서):
//   export default async function AdminCurationPage() {
//     const admin = await requireAdmin();  // 미인증/권한없음 → 자동 redirect
//     ...
//   }
//
// 한계:
// - 'use client' 컴포넌트에서 호출 금지 (next/navigation redirect는 RSC 전용)
// - middleware.ts에서 호출 금지 (별도 패턴 — middleware.ts 가 직접 검사)
//
// 스키마 정합:
// - user_profiles PK = user_id (not id)
// - RLS "own data": FOR ALL USING (auth.uid() = user_id) → 본인 row SELECT 가능
//
// v06.140 수정:
// - 역할·상태 판정을 lib/auth/account.ts 로 통일 (미들웨어와 기준이 갈라지지 않게).
// - 복귀 파라미터를 ?redirect= → ?next= 로 (로그인 화면이 읽는 이름과 일치시킴).
// - 매 요청 user.id/email 을 서버 콘솔에 찍던 로그 제거 (PII 유출 + 로그 노이즈).

import { redirect } from 'next/navigation'
import { cache } from 'react'

import { canAccessAdminConsole, isUsableAccount } from '@/lib/auth/account'
import { devAdminBypass } from '@/lib/auth/dev-bypass'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'
import type { AdminRole, AdminUser } from '@/lib/auth/types'

export type { AdminRole, AdminUser }

/**
 * RSC entry point에서 호출.
 *
 * 동작:
 * - 로그인 안 됨          → /login?next=<현재경로>
 * - 계정 정지·해지        → /login?error=suspended
 * - 프로필 없음 / 역할 부족 → / (홈)
 * - 통과 시 AdminUser 반환
 *
 * @param redirectTo 미인증 시 로그인 후 돌아갈 경로 (default: '/admin')
 *
 * @throws redirect() 호출 시 Next.js가 NEXT_REDIRECT 에러를 throw — 정상 동작.
 *         try/catch로 잡지 말 것.
 */
/**
 * 요청 1회당 한 번만 도는 신원 조회.
 *
 * **왜 `cache()` 인가**: admin 화면 한 장은 layout·page·데이터 로더가 각각 가드를 부른다.
 * 예를 들어 `/admin/vocab/curate/[run_id]` 는 layout + beginCuration + fetchRunDetail +
 * fetchQueueItems + fetchQueueDetail 로 **5번** 부르고, 매번 `auth.getUser()`(Auth 서버 왕복)
 * 와 `user_profiles` SELECT 가 따라붙어 **왕복 10회**가 됐다. 가드를 줄이면 방어가 얇아지므로
 * 호출을 줄이는 대신 **결과를 요청 단위로 재사용**한다. React `cache()` 는 요청마다 비므로
 * 사용자 간 신원이 섞이지 않는다.
 */
const loadIdentity = cache(
  async (): Promise<
    | { ok: true; user: AdminUser }
    | { ok: false; reason: 'anonymous' | 'no-profile' | 'blocked' | 'role' }
  > => {
    const client = await createClient()

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) return { ok: false, reason: 'anonymous' }

    const { data: profile, error: profileError } = await client
      .from('user_profiles')
      .select('role, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) return { ok: false, reason: 'no-profile' }

    const { role, status } = profile as { role: string | null; status: string | null }

    if (!isUsableAccount(status)) return { ok: false, reason: 'blocked' }
    if (!canAccessAdminConsole(role)) return { ok: false, reason: 'role' }

    return {
      ok: true,
      user: { id: user.id, email: user.email ?? null, role: role as AdminRole },
    }
  },
)

export async function requireAdmin(redirectTo: string = '/admin'): Promise<AdminUser> {
  // 개발 전용 우회 (DEV_ADMIN_BYPASS=1, 프로덕션 무효)
  const bypass = devAdminBypass()
  if (bypass) return bypass

  const result = await loadIdentity()
  if (result.ok) return result.user

  if (result.reason === 'anonymous') redirect(loginUrlWithReturn(redirectTo))
  if (result.reason === 'blocked') redirect('/login?error=suspended')
  redirect('/')
}

/**
 * requireAdmin의 약한 버전 — redirect 대신 null 반환.
 *
 * 사용 케이스:
 * - layout에서 admin 메뉴 표시 여부 결정 (admin이 아니어도 페이지는 보여줘야 함)
 * - Sidebar 분기 등
 *
 * RSC 전용.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const bypass = devAdminBypass()
  if (bypass) return bypass

  const result = await loadIdentity()
  return result.ok ? result.user : null
}
