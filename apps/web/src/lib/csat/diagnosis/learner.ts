// apps/web/src/lib/csat/diagnosis/learner.ts
//
// 학습자 화면의 조회 — 로그인 쿠키를 따르는 클라이언트(RLS: 본인 행만)로 읽는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { HomeDiagnosis } from '@/components/csat/diagnosis/DiagnosisHomeCard'
import { createClient } from '@/lib/supabase/server'

export async function learnerSession(): Promise<{ db: SupabaseClient; userId: string | null }> {
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  return { db, userId: user?.id ?? null }
}

/** 홈 카드 — 실패해도 홈을 깨뜨리지 않는다. 못 읽음(error)과 기록 없음(none)은 다른 상태다 */
export async function loadHomeDiagnosis(): Promise<HomeDiagnosis> {
  try {
    const { db, userId } = await learnerSession()
    if (!userId) return { kind: 'anon' }
    // 최근 한 회만 — 표시용으로 의도적으로 자른다. 개수는 count 로 따로 센다
    const { data, error, count } = await db.from('csat_dx_session')
      .select('exam_id, raw_score, grade, taken_at', { count: 'exact' })
      .eq('user_id', userId).not('exam_id', 'is', null)
      .order('taken_at', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    if (error) throw error
    const last = data?.[0]
    if (!last) return { kind: 'none' }
    const { data: exam, error: ee } = await db.from('csat_exams').select('label').eq('id', last.exam_id as string).maybeSingle()
    if (ee) throw ee
    return {
      kind: 'has',
      count: count ?? 1,
      latest: { label: (exam?.label as string | undefined) ?? (last.exam_id as string), raw: (last.raw_score as number | null) ?? 0, grade: last.grade as number | null, takenAt: last.taken_at as string },
    }
  } catch (e) {
    console.error('[csat-diagnosis] 홈 카드 조회 실패', e)
    return { kind: 'error' }
  }
}
