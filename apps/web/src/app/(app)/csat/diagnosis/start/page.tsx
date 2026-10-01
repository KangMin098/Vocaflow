// apps/web/src/app/(app)/csat/diagnosis/start/page.tsx
//
// 진단 시작 — ① 프로필(학년 · 목표 · 최저 조건 · 배경 5문항 · 주당 시간) → ② 시험 기록 입력 또는 진단 테스트.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { ProfileForm } from '@/components/csat/diagnosis/ProfileForm'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { loadLatestProfile } from '@/lib/csat/diagnosis/server'
import { railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '진단 시작 — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function DiagnosisStartPage() {
  const { db, userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis/start')
  const [profile, { count }] = await Promise.all([
    loadLatestProfile(db, userId),
    db.from('csat_dx_session').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  return (
    <DiagnosisShell exams={railExams()} screen="start">
      <h1 className="text-[22px] font-[800] text-[var(--t1)]">진단 시작</h1>
      <ProfileForm
        hasRecords={(count ?? 0) > 0}
        initial={
          profile
            ? {
                gradeLevel: profile.grade_level,
                goalType: profile.goal_type,
                minRule: profile.goal_detail?.min_rule ?? '',
                targetGrade: profile.goal_detail?.target_grade ?? null,
                background: profile.background ?? {},
                weeklyHours: profile.weekly_hours,
              }
            : null
        }
      />
    </DiagnosisShell>
  )
}
