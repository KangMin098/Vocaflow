// apps/web/src/lib/csat/diagnosis/learner.ts
//
// 학습자 화면의 조회 — 로그인 쿠키를 따르는 클라이언트(RLS: 본인 행만)로 읽는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type { HomeDiagnosis } from '@/components/csat/diagnosis/DiagnosisHomeCard'

import { loadSnapshots } from './snapshot'

export async function learnerSession(): Promise<{ db: SupabaseClient; userId: string | null }> {
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  return { db, userId: user?.id ?? null }
}

/** 홈 카드 — 실패해도 홈을 깨뜨리지 않는다(카드만 「진단 시작」으로) */
export async function loadHomeDiagnosis(): Promise<HomeDiagnosis> {
  try {
    const { db, userId } = await learnerSession()
    if (!userId) return { kind: 'anon' }
    const [latest] = await loadSnapshots(db, userId, 1)
    return latest ? { kind: 'has', snapshot: latest } : { kind: 'none' }
  } catch (e) {
    console.error('[csat-diagnosis] 홈 카드 조회 실패', e)
    return { kind: 'none' }
  }
}
