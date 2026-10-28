// apps/web/src/app/dev/shadow-echo/page.tsx
// 따라읽기 패널 → 같은 글 EchoMatch 링크 PC 실측 화면 — 실제 ShadowReadAlong 에 합성 상태(시작 전 · 완료)만 준다.
// 음성 · 마이크 · 서버 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'
import { ShadowEchoDev } from './dev'

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 상태 · 개인 데이터 아님 · 서버 기록 없음</p>
      <ShadowEchoDev />
    </main>
  )
}
