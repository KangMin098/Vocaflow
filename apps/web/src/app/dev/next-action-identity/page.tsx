// apps/web/src/app/dev/next-action-identity/page.tsx
// 추천 P2(본인 개인 글 이어 보기) 신원 결속 PC 실측 — 실제 useNextAction · useStoryAuthGuard · NextActionCard 에
// 합성 서버 응답(지연 가능)과 조작 가능한 브라우저 신원만 준다. 서버 조회 · DB 없음. 프로덕션 404.
import { notFound } from 'next/navigation'

import { NextActionIdentityDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 계정 · 합성 글 · 개인 데이터 아님 · 서버 기록 없음</p>
      <NextActionIdentityDev />
    </main>
  )
}
