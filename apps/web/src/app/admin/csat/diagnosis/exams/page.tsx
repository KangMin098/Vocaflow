// apps/web/src/app/admin/csat/diagnosis/exams/page.tsx
//
// 시험 목록 — 공식 1등급 비율 입력 · 태깅 진행 · 진단 반영 켜기/끄기.
// 진단 반영은 정답표 45문항 + 모든 문항 검수 완료일 때만 켜진다(서버가 다시 확인).

import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadExamTagging } from '@/lib/csat/diagnosis/admin'
import { createAdminClient } from '@/lib/supabase/admin'

import { ExamsTable } from './ExamsTable'

export const dynamic = 'force-dynamic'

export default async function DiagnosisExamsPage() {
  await requireAdmin('/admin/csat/diagnosis/exams')
  const exams = await loadExamTagging(createAdminClient() as unknown as SupabaseClient)
  return (
    <div className="flex flex-col gap-5">
      <DxHeader title="시험 · 태깅" lead="채점 가능한(정답표가 있는) 시험이 위에 와요. 시험 이름을 누르면 문항별 역량 가중치와 선지 함정을 검수하는 화면이 열려요.">
        <AdminScreenHelp screen="csat-diagnosis-exams" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/exams" />
      <ExamsTable exams={exams} />
    </div>
  )
}
