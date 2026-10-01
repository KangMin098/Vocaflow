// apps/web/src/app/admin/csat/diagnosis/learners/[id]/page.tsx
//
// 학습자 한 명 — 코드·수치가 들어간 상세 리포트 · 시험 기록 · 습관 응답 · 관리자 대리 입력(entered_by=admin).

import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import { DiagnosisReport } from '@/components/csat/diagnosis/DiagnosisReport'
import { OmrForm } from '@/components/csat/diagnosis/OmrForm'
import { requireAdmin } from '@/lib/auth/require-admin'
import { GOAL_LABEL, GRADE_LEVEL_LABEL } from '@/lib/csat/diagnosis/labels'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { listScorableExams, loadLatestProfile } from '@/lib/csat/diagnosis/server'
import { loadHabitFeedback, loadSnapshots } from '@/lib/csat/diagnosis/snapshot'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function DiagnosisLearnerPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()
  await requireAdmin(`/admin/csat/diagnosis/learners/${params.id}`)
  const db = createAdminClient() as unknown as SupabaseClient
  const { data: user } = await db.auth.admin.getUserById(params.id)
  if (!user?.user) notFound()
  const [snaps, profile, exams, { data: sessions, error }] = await Promise.all([
    loadSnapshots(db, params.id, 2),
    loadLatestProfile(db, params.id),
    listScorableExams(db),
    // 표시용 최근 100회 — 의도적으로 자른다
    db.from('csat_dx_session').select('id, exam_id, mode, taken_at, raw_score, grade, entered_by, created_at')
      .eq('user_id', params.id).order('taken_at', { ascending: false }).limit(100),
  ])
  if (error) throw new Error(`기록 조회 실패: ${error.message}`)
  const feedback = await loadHabitFeedback(db, snaps.map((s) => s.id))
  const goal = profile
    ? `${GRADE_LEVEL_LABEL[profile.grade_level] ?? profile.grade_level} · ${GOAL_LABEL[profile.goal_type] ?? profile.goal_type}${profile.goal_detail?.min_rule ? ` · 최저 ${profile.goal_detail.min_rule}` : ''}${profile.goal_detail?.target_grade ? ` · 영어 목표 ${profile.goal_detail.target_grade}등급` : ''}${profile.weekly_hours !== null ? ` · 주 ${profile.weekly_hours}시간` : ''}`
    : null

  return (
    <div className="flex flex-col gap-5">
      <DxHeader title={user.user.email ?? params.id} lead={goal ? `프로필: ${goal}` : '프로필이 아직 없어요.'}>
        <AdminScreenHelp screen="csat-diagnosis-learner" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/learners" />

      {snaps[0] ? (
        <DiagnosisReport snapshot={snaps[0]} previous={snaps[1] ?? null} variant="admin" feedback={feedback[snaps[0].id]} goalText={goal} />
      ) : (
        <p className="font-body text-[13px] text-[var(--t2)]">아직 진단 스냅샷이 없어요.</p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">시험 기록</h3>
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>응시일</th><th className={thCls}>시험</th><th className={thCls}>방식</th><th className={thCls}>원점수</th><th className={thCls}>등급</th><th className={thCls}>입력</th></tr></thead>
          <tbody>
            {(sessions ?? []).map((s) => (
              <tr key={s.id as string}>
                <td className={tdCls}>{s.taken_at as string}</td>
                <td className={tdCls}>{(s.exam_id as string | null) ?? '진단 테스트'}</td>
                <td className={tdCls}>{s.mode as string}</td>
                <td className={tdCls}>{(s.raw_score as number | null) ?? '—'}</td>
                <td className={tdCls}>{(s.grade as number | null) ?? '—'}</td>
                <td className={tdCls}>{s.entered_by === 'admin' ? '관리자 대리' : '학습자'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">대리 입력</h3>
        <p className="break-keep font-body text-[13px] text-[var(--t2)]">학습자 대신 시험 기록을 넣어요. 저장하면 이 학습자의 진단이 다시 계산돼요(되돌리기: 이 화면에서는 지울 수 없어요 — 잘못 넣었으면 DB 에서 그 세션을 지우고 스냅샷이 다시 쌓이게 기록을 하나 더 저장해요).</p>
        <OmrForm
          exams={exams.map((e) => ({ id: e.id, label: e.label, ready: e.diagnosis_ready }))}
          endpoint="/api/admin/csat/diagnosis/sessions"
          userId={params.id}
          trackEvents={false}
          today={todayKst(new Date())}
        />
      </section>
    </div>
  )
}
