// apps/web/src/hooks/useUserVLevel.ts
//
// 현재 사용자의 V레벨 (user_profiles.current_v_level) — i+1 레벨 권장 표시용.
// 미진단 시 0 (배지/판정 미표시). RLS 로 본인 행만 조회.

'use client'

import useSWR from 'swr'

import { createClient } from '@/lib/supabase/client'

async function fetchUserVLevel(): Promise<number> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { data } = await supabase
    .from('user_profiles')
    .select('current_v_level')
    .eq('user_id', user.id)
    .maybeSingle()
  return (data as { current_v_level: number | null } | null)?.current_v_level ?? 0
}

export function useUserVLevel(): number {
  const swr = useSWR('user-v-level', fetchUserVLevel, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  })
  return swr.data ?? 0
}
