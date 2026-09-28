// apps/web/src/app/(app)/csat/workspace/new/page.tsx
//
// **새 Workspace** — 출발점(가이드) → 목표·계획 → 담을 것(실제 포함 문항 미리보기) → 이름.
import type { Metadata } from 'next'

import { WorkspaceCreate } from '@/components/csat/workspace/WorkspaceCreate'
import { railExams } from '@/lib/csat/rail-data'
import { loadWorkspaceIndex } from '@/lib/csat/workspace-index'

export const metadata: Metadata = { title: '새 Workspace — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function CsatWorkspaceNewPage() {
  return <WorkspaceCreate index={await loadWorkspaceIndex()} exams={railExams()} />
}
