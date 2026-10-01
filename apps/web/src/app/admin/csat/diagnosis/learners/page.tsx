// apps/web/src/app/admin/csat/diagnosis/learners/page.tsx
//
// 진단 학습자 목록 — 프로필을 남겼거나 기록을 입력한 학습자와 최근 진단 요약.

import type { SupabaseClient } from '@supabase/supabase-js'
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadLearners } from '@/lib/csat/diagnosis/admin'
import { CONFIDENCE_LABEL } from '@/lib/csat/diagnosis/labels'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function DiagnosisLearnersPage() {
  await requireAdmin('/admin/csat/diagnosis/learners')
  const learners = await loadLearners(createAdminClient() as unknown as SupabaseClient)
  return (
    <div className="flex flex-col gap-5">
      <DxHeader title="학습자" lead="진단 프로필을 남겼거나 시험 기록을 입력한 학습자예요. 이름을 누르면 코드·수치가 들어간 상세 리포트와 기록, 대리 입력이 열려요.">
        <AdminScreenHelp screen="csat-diagnosis-learners" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/learners" />
      {learners.length === 0 ? (
        <p className="font-body text-[13px] text-[var(--t2)]">아직 진단 학습자가 없어요.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>학습자</th><th className={thCls}>기록</th><th className={thCls}>마지막 응시</th><th className={thCls}>능력</th><th className={thCls}>예상 등급</th><th className={thCls}>신뢰도</th></tr></thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.userId}>
                <td className={tdCls}><Link className="inline-flex min-h-[44px] items-center underline" href={`/admin/csat/diagnosis/learners/${l.userId}`}>{l.email ?? l.userId}</Link></td>
                <td className={tdCls}>{l.sessions}회</td>
                <td className={tdCls}>{l.lastTaken ?? '—'}</td>
                <td className={tdCls}>{l.snapshot?.ability ?? '—'}</td>
                <td className={tdCls}>{l.snapshot?.gradeEst ? `${l.snapshot.gradeEst}등급` : '—'}</td>
                <td className={tdCls}>{l.snapshot ? CONFIDENCE_LABEL[l.snapshot.confidence as keyof typeof CONFIDENCE_LABEL] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
