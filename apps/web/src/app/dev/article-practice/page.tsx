// apps/web/src/app/dev/article-practice/page.tsx
// R0 같은 기사 발췌 연습 PC 실측 — 실제 ArticlePracticeBridge(DcpPlayer · MeaningEvidence · 신원 경계)에
// 합성 문항 · 합성 채점(지연 가능) · 조작 가능한 브라우저 신원만 준다. 서버 조회 · 제출 · DB 없음. 프로덕션 404.
import { notFound } from 'next/navigation'

import { ArticlePracticeDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 계정 · 합성 문항 · 개인 데이터 아님 · 서버 기록 없음</p>
      <ArticlePracticeDev />
    </main>
  )
}
