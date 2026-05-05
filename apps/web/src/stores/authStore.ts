// apps/web/src/stores/authStore.ts
//
// Zustand 인증 스토어 — 클라이언트 전역 user/profile 상태.
//
// ⚠️ persist 미들웨어 사용 금지:
//   - 토큰은 Supabase ssr 가 httpOnly 쿠키로 자동 관리
//   - localStorage 에 user 객체 저장 시 XSS 노출 위험
//   - 페이지 새로고침 시 useUser() 의 onAuthStateChange 가 자동 복원

'use client'

import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'

import type { Tables } from '@vocaflow/types'

export type UserProfile = Tables<'user_profiles'>

interface AuthState {
  /** Supabase 인증 사용자 (id/email/metadata) — 로그아웃 시 null */
  user: User | null
  /** user_profiles 테이블 row — 로그인 후 자동 fetch */
  profile: UserProfile | null
  /** 초기 인증 상태 확인 중 여부 (앱 부팅 시 ~수백ms) */
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  /** 로그아웃 시 호출 — user/profile 모두 null 로 */
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, profile: null, isLoading: false }),
}))
