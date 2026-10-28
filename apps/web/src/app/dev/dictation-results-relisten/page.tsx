// apps/web/src/app/dev/dictation-results-relisten/page.tsx
// 받아쓰기 결과 문항 행(다시 듣기 · 당시 피드백) PC 실측 — 실제 DictationAttemptRows 에 합성 문항만 준다.
// 세션 · 결과 조회 · 서버 기록 없음. ?voice=0 은 영어 음성 없음 상태. 프로덕션 404.
import { notFound } from 'next/navigation'

import { DictationAttemptRows } from '@/components/dictation/DictationResultsClient'

export const dynamic = 'force-dynamic'

const base = { hintsUsed: 0, replayCount: 0, targetWords: [], targetHits: [] }
const attempts = [
  {
    ...base,
    itemIdx: 0,
    expected: 'The cats sat down by the window.',
    userInput: 'the cat sat by window',
    accuracy: 62,
    skipped: false,
    wordResults: [
      { expected: 'the', actual: 'the', status: 'correct' as const, similarity: 1 },
      { expected: 'cats', actual: 'cat', status: 'misspelled' as const, similarity: 0.8 },
      { expected: 'sat', actual: 'sat', status: 'correct' as const, similarity: 1 },
      { expected: 'down', actual: '', status: 'missing' as const, similarity: 0 },
      { expected: 'by', actual: 'by', status: 'correct' as const, similarity: 1 },
      { expected: 'the', actual: '', status: 'missing' as const, similarity: 0 },
      { expected: 'window', actual: 'window', status: 'correct' as const, similarity: 1 },
    ],
    errorTags: ['inflection', 'function-word'],
  },
  { ...base, itemIdx: 1, expected: 'An older item without word records.', userInput: 'an older item', accuracy: 40, skipped: false, wordResults: [], errorTags: [] },
  { ...base, itemIdx: 2, expected: 'This one was skipped.', userInput: '', accuracy: 0, skipped: true, wordResults: [], errorTags: [] },
]

export default function Page({ searchParams }: { searchParams: { voice?: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <p className="mb-4 font-display text-[12px] text-[var(--t2)]">합성 문항 · 개인 데이터 아님 · 서버 기록 없음</p>
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
        <DictationAttemptRows
          attempts={attempts}
          reviewEnabled
          voiceAvailable={searchParams.voice === '0' ? false : undefined}
        />
      </section>
    </main>
  )
}
