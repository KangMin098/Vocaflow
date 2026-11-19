// apps/web/src/app/dev/pairflip-results/page.tsx
// PairFlip 결과 화면 계정 경계 하네스 — 실제 PairFlipResultsGate · PairFlipResultScreen 에 합성 결과 · 주입 신원만 준다. 서버 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'
import { PairFlipResultsHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { owner?: string; browser?: string; slow?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <PairFlipResultsHarness owner={searchParams.owner ?? 'a'} browser={searchParams.browser ?? 'a'} slowMs={Number(searchParams.slow ?? 0)} />
}
