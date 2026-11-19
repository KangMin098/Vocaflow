// apps/web/src/app/dev/game-identity/page.tsx
// 게임 세션 계정 경계 PC 실측 하네스 — 실제 useGameSessionRecorder 에 합성 신원(주입) · 기록 함수 대역만 준다.
// 서버 Auth · scores · 단어 기록을 부르지 않는다(대역이 호출을 화면에 적기만 한다). 프로덕션 404.
import { notFound } from 'next/navigation'
import { GameIdentityHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { slow?: string; browser?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <GameIdentityHarness slowOwnerMs={Number(searchParams.slow ?? 0)} browserB={searchParams.browser === 'b'} />
}
