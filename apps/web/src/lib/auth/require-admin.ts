// apps/web/src/lib/auth/require-admin.ts
// LCP v2.0 Phase 12 — RSC 전용 admin/curator role 검증 유틸리티
//
// 사용 패턴 (RSC entry point에서):
//   export default async function AdminCurationPage() {
//     const admin = await requireAdmin();  // 미인증/권한없음 → 자동 redirect
//     // admin.id, admin.role 활용
//     ...
//   }
//
// 한계:
// - 'use client' 컴포넌트에서 호출 금지 (next/navigation redirect는 RSC 전용)
// - middleware.ts에서 호출 금지 (별도 패턴 필요)
// - layout.tsx에서 호출하면 모든 children에 적용 — 권장 패턴
//
// 스키마 정합 (RULE 5 + 사전 검증):
// - user_profiles PK = user_id (not id) — Phase 1 사전 검증 결과 반영
// - user_profiles RLS 정책 "own data": FOR ALL USING (auth.uid() = user_id)
//   → 본인 row SELECT 가능, anon key + RLS 로 안전하게 role 조회

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AdminRole = 'admin' | 'curator'

export interface AdminUser {
  /** auth.users.id */
  id: string
  /** auth.users.email — null 가능 (소셜 로그인 일부 케이스) */
  email: string | null
  /** user_profiles.role — admin 또는 curator 만 통과 */
  role: AdminRole
}

/**
 * RSC entry point에서 호출.
 *
 * 동작:
 * - 로그인 안 됨        → /login?redirect=<현재경로> redirect
 * - user_profiles 없음  → / redirect (홈)
 * - role !== admin/curator → / redirect (홈)
 * - 통과 시 AdminUser 반환
 *
 * @param redirectTo 미인증 시 로그인 후 돌아갈 경로 (default: '/admin')
 * @returns AdminUser
 *
 * @throws redirect() 호출 시 Next.js가 NEXT_REDIRECT 에러를 throw — 정상 동작.
 *         try/catch로 잡지 말 것.
 */
export async function requireAdmin(
  redirectTo: string = '/admin',
): Promise<AdminUser> {
  const client = await createClient()

  // 1. 인증 확인
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()

  if (userError || !user) {
    console.log('[requireAdmin] BRANCH 1: not authenticated →', userError?.message)
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`)
  }

  // 2. role 조회 (RLS "own data" 정책으로 본인 row만 SELECT)
  console.log('[requireAdmin] user.id =', user.id, 'email =', user.email)
  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error(
      '[requireAdmin] BRANCH 2: user_profiles fetch failed:',
      profileError.message,
    )
    redirect('/')
  }

  if (!profile) {
    console.log('[requireAdmin] BRANCH 3: profile not found for user_id =', user.id)
    redirect('/')
  }

  const role = (profile as { role: string | null }).role
  console.log('[requireAdmin] profile.role =', role)
  if (role !== 'admin' && role !== 'curator') {
    console.log('[requireAdmin] BRANCH 4: role rejected →', role)
    redirect('/')
  }
  console.log('[requireAdmin] PASS — admin/curator confirmed')

  return {
    id: user.id,
    email: user.email ?? null,
    role: role as AdminRole,
  }
}

/**
 * requireAdmin의 약한 버전 — redirect 대신 null 반환.
 *
 * 사용 케이스:
 * - layout에서 admin 메뉴 표시 여부 결정 (admin이 아니어도 페이지는 보여줘야 함)
 * - Sidebar 분기 등
 *
 * RSC 전용. Client 컴포넌트는 별도 hook 필요.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const client = await createClient()

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()

  if (userError || !user) return null

  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) return null

  const role = (profile as { role: string | null }).role
  if (role !== 'admin' && role !== 'curator') return null

  return {
    id: user.id,
    email: user.email ?? null,
    role: role as AdminRole,
  }
}
