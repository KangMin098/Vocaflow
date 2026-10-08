// apps/web/src/app/admin/csat/diagnosis/learners/[id]/page.tsx
//
// 학습자 한 명 — 학습자가 보는 것과 같은 진단(기록한 시험으로만) + 대리 기록(entered_by=admin).

import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav } from '@/components/admin/csat-diagnosis/ui'
import { DiagnosisBoard, boardHref, parseBoardTab } from '@/components/csat/diagnosis/DiagnosisBoard'
import { RecordDetailModal } from '@/components/csat/diagnosis/RecordDetailModal'
import { RecordModal } from '@/components/csat/diagnosis/RecordModal'
import { requireAdmin } from '@/lib/auth/require-admin'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { loadExamReport, loadPickerExams } from '@/lib/csat/diagnosis/report'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i


export default async function DiagnosisLearnerPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; view?: string; modal?: string; record?: string; focus?: string } }) {
  if (!UUID.test(params.id)) notFound()
  await requireAdmin(`/admin/csat/diagnosis/learners/${params.id}`)
  const db = createAdminClient() as unknown as SupabaseClient
  const { data: user } = await db.auth.admin.getUserById(params.id)
  if (!user?.user) notFound()
  const [{ report, typeNames }, exams] = await Promise.all([
    loadExamReport(db, params.id),
    searchParams.modal === 'new' ? loadPickerExams(db) : Promise.resolve(null),
  ])
  const base = `/admin/csat/diagnosis/learners/${params.id}`
  const { tab, view } = parseBoardTab(searchParams.tab, searchParams.view)
  const closeHref = boardHref(base, tab, view)
  const record = searchParams.record ? report.trend.find((t) => t.sessionId === searchParams.record) : undefined
  const modal = exams ? (
    <RecordModal exams={exams} today={todayKst(new Date())} closeHref={closeHref} diagnosisBase={base} endpoint="/api/admin/csat/diagnosis/sessions" userId={params.id} />
  ) : record ? (
    <RecordDetailModal
      record={record}
      wrongs={report.wrongAll.filter((w) => w.sessionId === record.sessionId)}
      typeNames={typeNames}
      closeHref={closeHref}
      diagnosisHref={`${base}?focus=${record.sessionId}`}
      deleteEndpoint={`/api/admin/csat/diagnosis/sessions?userId=${params.id}&id=${record.sessionId}`}
    />
  ) : null

  return (
    <div className="flex flex-col gap-5">
      <DxHeader title={user.user.email ?? params.id} lead="학습자가 보는 진단과 같은 화면이에요. 「시험 기록」으로 학습자 대신 기록하고, 기록 줄을 눌러 지울 수 있어요.">
        <AdminScreenHelp screen="csat-diagnosis-learner" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/learners" />
      <DiagnosisBoard report={report} typeNames={typeNames} tab={tab} view={view} base={base} addHref={`${base}?tab=records&modal=new`} modal={modal} focus={searchParams.focus} />
    </div>
  )
}
