// apps/web/src/app/dev/textbook-practice-scope/page.tsx
// 교재 연습 조회 경로 안내 PC 실측 — 실제 TextbookPracticeScope(+ DcpPlayer)에 합성 문항 · 합성 채점만 준다.
// ?scope=volume | legacy_v_level | unknown. 서버 조회 · 제출 · DB 없음. 프로덕션 404.
import { notFound } from 'next/navigation'

import { TextbookPracticeScopeDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 문항 · 합성 채점 · 개인 데이터 아님 · 서버 기록 없음</p>
      <TextbookPracticeScopeDev />
    </main>
  )
}
