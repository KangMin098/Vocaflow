// apps/web/src/hooks/useAuth.ts
//
// 인증 훅 + signOut 함수.
//
// 제공 API:
//   - useUser()         — 현재 user / profile / role / isLoading / isAuthenticated 반환
//   - signOut()         — 로그아웃 후 '/' 로 hard reload (서버 캐시 무효화)
//
// 동작:
//   - 첫 useUser() 호출 시 모듈 단일 리스너 초기화 (다중 컴포넌트가 호출해도 1번만)
//   - supabase.auth.onAuthStateChange 로 SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED 추적
//   - 인증 후 user_profiles 자동 fetch (없으면 profile=null 유지)
//
// ⚠️ 보안:
//   - 토큰은 Supabase ssr 가 httpOnly 쿠키로 관리 (브라우저 JS 접근 X)
//   - 본 훅은 user 객체 (id/email/metadata) 만 노출
//   - console.log 시 user.id 만 (전체 객체 출력 금지)

'use client'

import { useEffect } from 'react'

import type { UserRole } from '@vocaflow/types'
import { useAuthStore, type UserProfile } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'

// ────────────────────────────────────────────────────────────
// 모듈 single-shot 리스너 초기화
// ────────────────────────────────────────────────────────────

let initialized = false
let unsubscribe: (() => void) | null = null

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    // 프로필 미존재 = 신규 사용자 (auth 가입 직후 / 트리거 미설정 등) — null 로 유지
    return null
  }
  return data
}

function ensureAuthListener() {
  if (initialized) return
  initialized = true

  const supabase = createClient()
  const store = useAuthStore.getState()

  // 초기 사용자 로드 (페이지 첫 mount 시)
  void supabase.auth.getUser().then(async ({ data: { user } }) => {
    if (user) {
      store.setUser(user)
      const profile = await fetchProfile(user.id)
      store.setProfile(profile)
    }
    store.setLoading(false)
  })

  // 인증 이벤트 리스너 — 로그인/로그아웃/토큰 갱신
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        useAuthStore.getState().clear()
        return
      }
      if (session.user) {
        useAuthStore.getState().setUser(session.user)
        const profile = await fetchProfile(session.user.id)
        useAuthStore.getState().setProfile(profile)
        useAuthStore.getState().setLoading(false)
      }
    },
  )

  unsubscribe = () => subscription.unsubscribe()
}

// ────────────────────────────────────────────────────────────
// useUser — 현재 인증 상태를 반환하는 hook
// ────────────────────────────────────────────────────────────

export interface UseUserResult {
  user: ReturnType<typeof useAuthStore.getState>['user']
  profile: UserProfile | null
  /** user_profiles.role — 로딩/미인증 시 'user' (안전 기본값) */
  role: UserRole | string
  isLoading: boolean
  isAuthenticated: boolean
}

/**
 * 클라이언트 컴포넌트에서 현재 인증 사용자 정보를 구독합니다.
 *
 * @example
 *   'use client'
 *   import { useUser } from '@/hooks/useAuth'
 *
 *   export function Header() {
 *     const { user, role, isLoading } = useUser()
 *     if (isLoading) return <Skeleton />
 *     if (!user) return <LoginCTA />
 *     return <span>{role === 'admin' ? '👑 ' : ''}{user.email}</span>
 *   }
 */
export function useUser(): UseUserResult {
  // 첫 호출 시 단일 리스너 셋업 (서버에서는 useEffect 가 안 돌아 안전)
  useEffect(() => {
    ensureAuthListener()
    // 모듈 unmount 시 unsubscribe — Next.js dev fast refresh 대응
    return () => {
      // 다른 사용자도 구독 중일 수 있으니 명시적 unmount 시에만 정리
      // (앱 종료 시 자동으로 GC 됨)
    }
  }, [])

  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.isLoading)

  return {
    user,
    profile,
    role: profile?.role ?? 'user',
    isLoading,
    isAuthenticated: !!user,
  }
}

// ────────────────────────────────────────────────────────────
// signOut — 로그아웃 + 메인 진입점으로 이동
// ────────────────────────────────────────────────────────────

/**
 * Supabase 세션을 종료하고 `/` 로 hard reload 합니다.
 *
 * hard reload 이유:
 *   - Server Component 캐시 무효화 (`supabase/server.ts` 가 새 세션으로 재실행)
 *   - 다른 탭/브라우저의 세션도 onAuthStateChange 로 자동 SIGNED_OUT
 *
 * @example
 *   import { signOut } from '@/hooks/useAuth'
 *   <button onClick={() => signOut()}>로그아웃</button>
 */
export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  useAuthStore.getState().clear()
  if (typeof window !== 'undefined') {
    window.location.href = '/'
  }
}

// ────────────────────────────────────────────────────────────
// 정리 헬퍼 (테스트용)
// ────────────────────────────────────────────────────────────

/** @internal — 단위 테스트에서 모듈 상태 리셋용 */
export function __resetAuthListener() {
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  initialized = false
}
