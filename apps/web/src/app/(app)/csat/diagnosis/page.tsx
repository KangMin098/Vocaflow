// apps/web/src/app/(app)/csat/diagnosis/page.tsx
//
// 내 진단 — 모니터링 보드(개요 · 유형 · 오답 함정 · 틀린 문항 · 시험 기록). 기록한 학평 · 모평 · 수능 답안으로만 만든다.
// 새 기록 · 기록 상세는 같은 화면의 모달(?tab=records&modal=new · &record=<id>).
// 로그인 확인 뒤 서버가 service role 로 기록 + 문항 유형(번호·유형만) + 선지 함정을 읽는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisBoard, type BoardTab } from '@/components/csat/diagnosis/DiagnosisBoard'
import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { RecordDetailModal } from '@/components/csat/diagnosis/RecordDetailModal'
import { RecordModal } from '@/components/csat/diagnosis/RecordModal'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { loadExamReport, loadPickerExams } from '@/lib/csat/diagnosis/report'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: '내 진단 — 기출분석공간' }
export const dynamic = 'force-dynamic'

const TABS: BoardTab[] = ['overview', 'types', 'traps', 'wrong', 'records']
const BASE = '/csat/diagnosis'

export default async function DiagnosisPage({ searchParams }: { searchParams: { tab?: string; modal?: string; record?: string; focus?: string } }) {
  const { userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis')
  const tab = TABS.find((t) => t === searchParams.tab) ?? 'overview'
  const db = createAdminClient() as unknown as SupabaseClient
  const [{ report, typeNames }, exams] = await Promise.all([
    loadExamReport(db, userId),
    searchParams.modal === 'new' ? loadPickerExams(db) : Promise.resolve(null),
  ])
  const closeHref = tab === 'overview' ? BASE : `${BASE}?tab=${tab}`
  const record = searchParams.record ? report.trend.find((t) => t.sessionId === searchParams.record) : undefined

  const modal = exams ? (
    <RecordModal exams={exams} today={todayKst(new Date())} closeHref={closeHref} diagnosisBase={BASE} />
  ) : record ? (
    <RecordDetailModal
      record={record}
      wrongs={report.wrongAll.filter((w) => w.sessionId === record.sessionId)}
      typeNames={typeNames}
      closeHref={closeHref}
      diagnosisHref={`${BASE}?focus=${record.sessionId}`}
      deleteEndpoint={`/api/csat/diagnosis/sessions?id=${record.sessionId}`}
    />
  ) : null

  return (
    <DiagnosisShell exams={railExams()} screen="report">
      <DiagnosisBoard report={report} typeNames={typeNames} tab={tab} base={BASE} addHref={`${BASE}?tab=records&modal=new`} modal={modal} focus={searchParams.focus} />
    </DiagnosisShell>
  )
}
