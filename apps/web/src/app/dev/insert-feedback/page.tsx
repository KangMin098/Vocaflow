// apps/web/src/app/dev/insert-feedback/page.tsx
// 삽입 해설 후보 번호 ↔ 실제 이음매 PC 실측 화면 — 실제 DcpPlayer 에 합성 삽입 문항과 로컬 채점만 준다.
// 서버 채점 · attempt 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'
import { InsertFeedbackDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 문항 · 개인 데이터 아님 · 서버 기록 없음</p>
      <InsertFeedbackDev />
    </main>
  )
}
