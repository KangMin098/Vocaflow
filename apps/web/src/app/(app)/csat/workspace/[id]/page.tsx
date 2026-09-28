// apps/web/src/app/(app)/csat/workspace/[id]/page.tsx
//
// **Workspace 안** — 다음 3문항 · 진행 · 약점 변화(예측 적중) · 보완 제안 · 담은 것 고치기.
// id 는 학습자 기록 안의 키라 서버가 찾지 않는다 — 화면이 기록을 읽고 찾는다(없으면 화면이 말한다).
import type { Metadata } from 'next'
import { Suspense } from 'react'

import { WorkspaceDetail } from '@/components/csat/workspace/WorkspaceDetail'
import { railExams } from '@/lib/csat/rail-data'
import { loadWorkspaceIndex } from '@/lib/csat/workspace-index'

export const metadata: Metadata = { title: 'Workspace — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function CsatWorkspacePage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id).slice(0, 64)
  const [index, exams] = [await loadWorkspaceIndex(), railExams()]
  return (
    <Suspense fallback={null}>
      <WorkspaceDetail id={id} index={index} exams={exams} />
    </Suspense>
  )
}
