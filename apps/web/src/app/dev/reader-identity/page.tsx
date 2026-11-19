// apps/web/src/app/dev/reader-identity/page.tsx
// 읽기 화면 계정 경계 PC 실측 하네스 — 실제 ReaderViewerGate + 실제 읽기 음성(tts-controller)에 합성 지문 · 주입 신원만 준다.
// 실제 /text/[id] 레이아웃(GET 중 기록 쓰기)은 부르지 않는다. 서버 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'
import { ReaderIdentityHarness } from './harness'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { browser?: string; slow?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ReaderIdentityHarness browserB={searchParams.browser === 'b'} slowMs={Number(searchParams.slow ?? 0)} />
}
