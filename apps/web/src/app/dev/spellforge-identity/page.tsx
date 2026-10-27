// apps/web/src/app/dev/spellforge-identity/page.tsx
// SpellForge 계정 경계 PC 실측 하네스 — 실제 GameViewerGate + SpellForge + 실제 평가 대기열(srs_pending)에 합성 단어 · 주입 신원만 준다.
// 서버 Auth 를 쓰지 않는다. 실제 화면의 flush · 추천 조회(서버 Action)는 남아 있으므로 시험이 전송 전에 막고 센다. 프로덕션 404.
import { notFound } from 'next/navigation'
import { SpellForgeIdentityHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { browser?: string; slow?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <SpellForgeIdentityHarness browserB={searchParams.browser === 'b'} slowMs={Number(searchParams.slow ?? 0)} />
}
