// apps/web/src/app/(app)/csat/listening/page.tsx
//
// 듣기 근거 추적 도구(I5 · I8) — 로컬 픽스처(2023 수능 7 · 10번). 보호 라우트(`/csat` 접두사).
// 정답 민감 층(L4 · L5)은 Reveal Gate(`embargo-gate.ts`)의 회차 판정이 'open' 이고 학습자가 제출했을 때만 열린다.
// 판정이 실패하면 'failure'(닫힘)로 내려 보낸다 — fail-closed.
// 'open' 이 아니면 정답 민감 필드를 서버에서 지워 보낸다(redactForClient). 'open' 이면 정답이 공개된 상태라 그대로 보내고
// 제출 전 숨김은 클라이언트 exposure.ts 가 맡는다.

import type { Metadata } from 'next'
import { Headphones } from 'lucide-react'

import { CsatShell } from '@/components/csat/home/CsatShell'
import { ListeningTracer } from '@/components/csat/listening/ListeningTracer'
import { examRevealDecision, type RevealDecision } from '@/lib/csat/embargo-gate'
import { TRACE_FIXTURES, redactForClient } from '@/lib/csat/listening/fixtures'
import { railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '듣기 근거 추적 — 기출' }
export const dynamic = 'force-dynamic'

async function revealFor(examId: string): Promise<RevealDecision> {
  try {
    return await examRevealDecision(examId)
  } catch {
    return 'failure'
  }
}

export default async function ListeningTracePage({ searchParams }: { searchParams?: { item?: string } }) {
  // 지금 픽스처는 모두 2023 회차다 — 회차가 늘면 회차별로 판정한다
  const [exams, reveal] = await Promise.all([railExams(), revealFor('2023')])
  const item = typeof searchParams?.item === 'string' ? searchParams.item : null
  return (
    <CsatShell place="practice" exams={exams} pill={<><Headphones size={13} aria-hidden="true" />듣기 근거 추적</>}>
      <ListeningTracer fixtures={TRACE_FIXTURES.map((f) => redactForClient(f, reveal))} initialKey={item} reveal={reveal} />
    </CsatShell>
  )
}
