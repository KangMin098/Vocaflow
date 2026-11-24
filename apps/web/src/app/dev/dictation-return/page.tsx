// apps/web/src/app/dev/dictation-return/page.tsx
// 받아쓰기 결과의 「하던 학습으로 돌아가기」 · 같은 자료 재시도 PC 실측 — 실제 DictationResultActions 에 합성 세션 좌표만 준다.
// 쿼리 ?from= 을 그대로 쓴다(불량 값 확인용). 세션 · 결과 조회 · 서버 기록 없음. 프로덕션 404.
import { notFound } from 'next/navigation'

import { DictationResultActions } from '@/components/dictation/DictationResultsClient'
import { dictationFrom } from '@/lib/dictation/return'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { from?: string; kind?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const from = dictationFrom(searchParams.from ?? null)
  const retry =
    searchParams.kind === 'set'
      ? { sharedSetId: 'dev-set', chapterIdx: 2 }
      : searchParams.kind === 'custom'
        ? {}
        : { textId: 'dev-text' }
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 좌표 · 개인 데이터 아님 · 서버 기록 없음</p>
      <div className="flex flex-col gap-4">
        <DictationResultActions retry={retry} from={from} />
      </div>
    </main>
  )
}
