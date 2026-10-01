// apps/web/src/app/admin/csat/diagnosis/exams/[examId]/page.tsx
//
// 시험 한 회의 태깅 — 문항별 역량 가중치(0~2) · 오답 선지 함정 · 공식 오답률 · EBS 연계.
// 「검수 저장」을 눌러야 그 문항이 검수 완료로 센다(유형 기본값만 있는 상태는 미완료).

import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadExamItemsForTagging, loadTrapOptions } from '@/lib/csat/diagnosis/admin'
import { createAdminClient } from '@/lib/supabase/admin'

import { TaggingBoard } from './TaggingBoard'

export const dynamic = 'force-dynamic'

export default async function ExamTaggingPage({ params }: { params: { examId: string } }) {
  const examId = decodeURIComponent(params.examId)
  await requireAdmin(`/admin/csat/diagnosis/exams/${params.examId}`)
  const db = createAdminClient() as unknown as SupabaseClient
  const { data: exam } = await db.from('csat_exams').select('id, label, diagnosis_ready').eq('id', examId).maybeSingle()
  if (!exam) notFound()
  const [items, trapOptions] = await Promise.all([loadExamItemsForTagging(db, examId), loadTrapOptions(db)])
  const reviewed = items.filter((i) => i.reviewedAt).length
  return (
    <div className="flex flex-col gap-5">
      <DxHeader
        title={`${exam.label} — 태깅`}
        lead={`검수 ${reviewed}/${items.length}. 듣기(1~17번)는 문항 데이터가 없어 태깅하지 않아요 — 엔진이 듣기 역량(A7)으로 셉니다. 진단 반영은 ${exam.diagnosis_ready ? '켜져 있어요' : '꺼져 있어요(점수만 반영)'}.`}
      >
        <AdminScreenHelp screen="csat-diagnosis-tagging" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/exams" />
      <TaggingBoard items={items} trapOptions={trapOptions} />
    </div>
  )
}
