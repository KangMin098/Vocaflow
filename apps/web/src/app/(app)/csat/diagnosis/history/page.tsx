// apps/web/src/app/(app)/csat/diagnosis/history/page.tsx
//
// 진단 이력 — 스냅샷 목록(최근 50)과 두 개 비교.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { HistoryCompare } from '@/components/csat/diagnosis/HistoryCompare'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { loadSnapshots } from '@/lib/csat/diagnosis/snapshot'
import { railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '진단 이력 — 내 진단' }
export const dynamic = 'force-dynamic'

export default async function DiagnosisHistoryPage() {
  const { db, userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis/history')
  const snaps = await loadSnapshots(db, userId, 50)
  return (
    <DiagnosisShell exams={await railExams()} screen="history">
      <h1 className="text-[22px] font-[800] text-[var(--t1)]">진단 이력</h1>
      {snaps.length === 0 ? (
        <p className="font-body text-[14px] text-[var(--t2)]">아직 진단 이력이 없어요.</p>
      ) : (
        <HistoryCompare snapshots={snaps} />
      )}
    </DiagnosisShell>
  )
}
