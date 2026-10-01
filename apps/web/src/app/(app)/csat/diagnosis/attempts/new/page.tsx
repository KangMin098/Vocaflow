// apps/web/src/app/(app)/csat/diagnosis/attempts/new/page.tsx
//
// 시험 기록 입력(OMR). 고를 수 있는 시험은 45문항 정답표가 있는 회차뿐이다(현재 평가원 수능·모평).
// 진단 반영이 꺼진 시험은 「점수만 반영, 상세 진단은 준비 중」으로 안내한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { OmrForm } from '@/components/csat/diagnosis/OmrForm'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { listScorableExams } from '@/lib/csat/diagnosis/server'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: '시험 기록 입력 — 내 진단' }
export const dynamic = 'force-dynamic'

export default async function DiagnosisAttemptPage() {
  const { userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis/attempts/new')
  // 정답표 표는 학습자에게 열려 있지 않다 — 시험 이름·준비 여부만 서버에서 읽어 넘긴다(정답은 넘기지 않는다)
  const exams = await listScorableExams(createAdminClient() as unknown as SupabaseClient)
  return (
    <DiagnosisShell exams={railExams()} screen="attempt">
      <h1 className="text-[22px] font-[800] text-[var(--t1)]">시험 기록 입력</h1>
      <OmrForm
        exams={exams.map((e) => ({ id: e.id, label: e.label, ready: e.diagnosis_ready }))}
        endpoint="/api/csat/diagnosis/sessions"
        reportHref="/csat/diagnosis"
        today={todayKst(new Date())}
      />
      <p className="break-keep font-body text-[13px] text-[var(--t2)]">
        지금은 평가원 수능·모의평가만 입력할 수 있어요. 학력평가는 듣기 정답표가 준비되면 추가돼요.
      </p>
    </DiagnosisShell>
  )
}
