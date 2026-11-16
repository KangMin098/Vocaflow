// apps/web/src/app/(app)/csat/listening/page.tsx
//
// 듣기 근거 추적 도구(I5 · I8) — 로컬 픽스처(2023 수능 7 · 10번). 보호 라우트(`/csat` 접두사).
// 첫 렌더 props 는 Reveal Gate 판정과 무관하게 항상 정답을 지운 픽스처다(redactForClient).
// 분석(L4 · L5 · 근거 역할)은 학습자가 제출한 뒤 서버 액션 `revealListeningAnalysis` 가 판정을 다시 해 'open' 일 때만 준다.

import type { Metadata } from 'next'
import { Headphones } from 'lucide-react'

import { CsatShell } from '@/components/csat/home/CsatShell'
import { ListeningTracer } from '@/components/csat/listening/ListeningTracer'
import { TRACE_FIXTURES, redactForClient } from '@/lib/csat/listening/fixtures'
import { railExams } from '@/lib/csat/rail-data'

import { revealListeningAnalysis } from './actions'

export const metadata: Metadata = { title: '듣기 근거 추적 — 기출' }
export const dynamic = 'force-dynamic'

export default async function ListeningTracePage({ searchParams }: { searchParams?: { item?: string } }) {
  const exams = await railExams()
  const item = typeof searchParams?.item === 'string' ? searchParams.item : null
  return (
    <CsatShell place="practice" exams={exams} pill={<><Headphones size={13} aria-hidden="true" />듣기 근거 추적</>}>
      <ListeningTracer fixtures={TRACE_FIXTURES.map(redactForClient)} initialKey={item} loadAnalysis={revealListeningAnalysis} />
    </CsatShell>
  )
}
