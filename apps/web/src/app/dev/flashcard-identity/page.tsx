// apps/web/src/app/dev/flashcard-identity/page.tsx
// 카드 세션 계정 경계 PC 실측 하네스 — 실제 FlashcardSession + FlashcardViewerGate + 실제 대기열(lib/srs/session-storage)에 합성 단어 · 주입 신원만 준다.
// 서버 Auth 를 쓰지 않는다. 실제 세션의 이탈 flush(서버 Action)는 남아 있으므로 시험이 전송 전에 막고 센다. 프로덕션 404.
import { notFound } from 'next/navigation'
import { FlashcardIdentityHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { gate?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <FlashcardIdentityHarness gated={searchParams.gate !== '0'} />
}
