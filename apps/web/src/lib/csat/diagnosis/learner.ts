// apps/web/src/lib/csat/diagnosis/learner.ts
//
// 학습자 화면의 조회. 로그인 확인은 쿠키 클라이언트로 하고, **점수 · 등급은 서버(service role)가 Reveal Gate 를 거쳐 읽는다** —
// Reveal Gate ②(20261005170100)가 학습자 JWT 의 csat_dx_session.raw_score · grade 직접 조회를 회수하므로
// 홈 카드가 쿠키 클라이언트로 점수를 읽으면 그 뒤로 조회 오류가 된다. 보류 시험(오답 원인 Pilot 수집 중)의 기록은
// 개수 · 최근 회 모두에서 뺀다(DB 정책 csat_dx_session_own_select 와 같은 판정 — embargo-gate).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { HomeDiagnosis } from '@/components/csat/diagnosis/DiagnosisHomeCard'
import { examEmbargoDecision } from '@/lib/csat/embargo-gate'
import { keysetSelect } from '@/lib/supabase/keyset-select'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function learnerSession(): Promise<{ db: SupabaseClient; userId: string | null }> {
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  return { db, userId: user?.id ?? null }
}

interface SessionKey { id: string; exam_id: string; taken_at: string; created_at: string }

/** 홈 카드 — 실패해도 홈을 깨뜨리지 않는다. 못 읽음(error)과 기록 없음(none)은 다른 상태다 */
export async function loadHomeDiagnosis(): Promise<HomeDiagnosis> {
  try {
    const { userId } = await learnerSession()
    if (!userId) return { kind: 'anon' }
    // userId 는 위 로그인 확인에서만 온다 — 서버 클라이언트는 그 학습자의 행만 읽는다
    const db = createAdminClient() as unknown as SupabaseClient
    // 점수 없이 기록 키만 먼저 — 보류 판정 전에 점수를 읽지 않는다
    const keys = await keysetSelect<SessionKey, string>(
      (cursor, limit) => {
        const q = db.from('csat_dx_session').select('id, exam_id, taken_at, created_at').eq('user_id', userId).not('exam_id', 'is', null).order('id').limit(limit)
        return cursor === null ? q : q.gt('id', cursor)
      },
      (r) => r.id,
      '홈 카드 기록',
    )
    // 판정 실패를 「기록 없음」으로 보이지 않는다 — 기록이 있는데 none 이면 학습자가 다시 입력한다(Codex P2)
    const { held, failed } = await examEmbargoDecision(keys.map((k) => k.exam_id))
    if (failed) return { kind: 'error' }
    const visible = keys.filter((k) => !held.has(k.exam_id))
      .sort((a, b) => b.taken_at.localeCompare(a.taken_at) || b.created_at.localeCompare(a.created_at))
    const last = visible[0]
    if (!last) return { kind: 'none' }
    const [{ data: score, error: se }, { data: exam, error: ee }] = await Promise.all([
      db.from('csat_dx_session').select('raw_score, grade').eq('id', last.id).eq('user_id', userId).maybeSingle(),
      db.from('csat_exams').select('label').eq('id', last.exam_id).maybeSingle(),
    ])
    if (se) throw se
    if (ee) throw ee
    return {
      kind: 'has',
      count: visible.length,
      latest: { label: (exam?.label as string | undefined) ?? last.exam_id, raw: (score?.raw_score as number | null) ?? 0, grade: (score?.grade as number | null) ?? null, takenAt: last.taken_at },
    }
  } catch (e) {
    console.error('[csat-diagnosis] 홈 카드 조회 실패', e)
    return { kind: 'error' }
  }
}
