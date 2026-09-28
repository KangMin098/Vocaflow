// apps/web/src/app/(app)/csat/workspace/page.tsx
//
// **내 Workspace 목록** — 학습자가 기출 단위를 골라 담은 학습 묶음(docs/csat-learner/workspace-design.md).
// Workspace 자체는 브라우저가 읽는다(기기 + `/api/csat/state`). 서버는 문항 색인(원문 없음)과 회차 목록만 넘긴다.
import type { Metadata } from 'next'

import { WorkspaceListScreen } from '@/components/csat/workspace/WorkspaceListScreen'
import { railExams } from '@/lib/csat/rail-data'
import { loadWorkspaceIndex } from '@/lib/csat/workspace-index'

export const metadata: Metadata = { title: '내 Workspace — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function CsatWorkspaceListPage() {
  return <WorkspaceListScreen index={await loadWorkspaceIndex()} exams={railExams()} />
}
