// apps/web/src/app/dev/meaning-evidence/page.tsx
// 의미 선택 뒤 「본문 근거 짚기」 PC 실측 화면 — 실제 DcpPlayer 에 합성 문항(제목 · 주제 · 빈칸)과 로컬 채점만 준다.
// 서버 채점 · attempt 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'
import { MeaningEvidenceDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 문항 · 개인 데이터 아님 · 서버 기록 없음</p>
      <MeaningEvidenceDev />
    </main>
  )
}
