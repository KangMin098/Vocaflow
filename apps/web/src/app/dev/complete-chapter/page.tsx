// apps/web/src/app/dev/complete-chapter/page.tsx
// T-0192 — 읽기 완료 버튼 PC 실측 하네스. fake 응답만 쓴다(DB·Auth 없음). 프로덕션 404.
import { notFound } from 'next/navigation'
import { CompleteChapterHarness } from './harness'

export default function Page({ searchParams }: { searchParams: { mode?: string; delay?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <CompleteChapterHarness mode={searchParams.mode ?? 'ok'} delayMs={Number(searchParams.delay ?? 300)} />
}
