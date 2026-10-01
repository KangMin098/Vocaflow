// apps/web/src/app/(app)/csat/diagnosis/page.tsx
//
// 내 진단 리포트 — 최신 스냅샷 하나를 쉬운 말로. 직전 스냅샷과 비교해 역량 증감(▲▼)을 보인다.
// 스냅샷이 없으면 진단 시작으로 안내한다. 읽기는 본인 RLS 클라이언트로 한다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DiagnosisReport } from '@/components/csat/diagnosis/DiagnosisReport'
import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { GOAL_LABEL } from '@/lib/csat/diagnosis/labels'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { loadLatestProfile } from '@/lib/csat/diagnosis/server'
import { loadHabitFeedback, loadSnapshots } from '@/lib/csat/diagnosis/snapshot'
import { railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '내 진단 — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function DiagnosisReportPage() {
  const { db, userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis')
  const [snaps, profile] = await Promise.all([loadSnapshots(db, userId, 2), loadLatestProfile(db, userId)])
  const latest = snaps[0]
  const feedback = latest ? (await loadHabitFeedback(db, [latest.id]))[latest.id] : undefined
  const goal = profile
    ? [
        GOAL_LABEL[profile.goal_type],
        profile.goal_detail?.min_rule ? `최저 ${profile.goal_detail.min_rule}` : null,
        profile.goal_detail?.target_grade ? `영어 ${profile.goal_detail.target_grade}등급` : null,
      ].filter(Boolean).join(' · ')
    : null

  return (
    <DiagnosisShell exams={railExams()} screen="report">
      <h1 className="text-[22px] font-[800] text-[var(--t1)]">내 진단 리포트</h1>
      {latest ? (
        <DiagnosisReport snapshot={latest} previous={snaps[1] ?? null} variant="learner" feedback={feedback} goalText={goal} />
      ) : (
        <section className="flex flex-col gap-3">
          <p className="break-keep font-body text-[15px] text-[var(--t1)]">아직 진단이 없어요. 프로필을 남기고 모의고사 기록을 입력하거나 진단 테스트를 풀면 첫 리포트가 만들어져요.</p>
          <Link
            href="/csat/diagnosis/start"
            className="inline-flex min-h-[48px] w-fit items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[15px] font-[800] text-[var(--on-p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            진단 시작
          </Link>
        </section>
      )}
    </DiagnosisShell>
  )
}
