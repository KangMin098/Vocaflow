// apps/web/src/components/spellforge/SpellForgeCompletion.tsx
// SpellForge 세션 종료 화면 — 통계 + 다음 추천 (§17.3 추천 축 3곳 중 1곳)

'use client'

import { useState } from 'react'
import Link from 'next/link'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import type { ContentRef } from '@/lib/content/content-ref'
import type { RecommendedAction } from '@/lib/recommend/types'
import { useRecordGameScore } from '@/lib/scores/record-score'

interface SpellForgeCompletionProps {
  totalWords: number
  correctCount: number
  /** 세션 시작 시각 — 컴포넌트 마운트 시 1회 lazy 계산 */
  startedAt: Date
  /** 세션 종료 시 복귀 경로 — 페이지가 ?from/스코프로 계산. */
  backHref: string
  /** 무엇으로 학습했나 — scores 콘텐츠 귀속(없으면 자료 미상으로 남는다). */
  content?: ContentRef
  /** §17.3 추천 축 — 부모가 주입 */
  recommendation?: RecommendedAction
}

export function SpellForgeCompletion({
  totalWords,
  correctCount,
  startedAt,
  backHref,
  content,
  recommendation,
}: SpellForgeCompletionProps) {
  // 마운트 시점에 durationMs 1회 캡처 — 이후 리렌더에 영향 없음
  const [durationMs] = useState(() => Date.now() - startedAt.getTime())

  const minutes = Math.max(1, Math.round(durationMs / 60000))
  const accuracy = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0

  // 게임 세션 점수 적재 (scores) — 완료 화면 1회.
  useRecordGameScore({
    module: 'spellforge',
    score: correctCount,
    totalQuestions: totalWords,
    correctCount,
    accuracy,
    durationSeconds: Math.round(durationMs / 1000),
    content,
    metadata: { totalWords, correctCount },
  })

  return (
    <section className="flex flex-1 items-center justify-center bg-[var(--reading-bg)] p-8">
      <div className="w-full max-w-[600px] text-center">
        <span
          className="mb-6 inline-block animate-[celebrate_1s_var(--ease-spring)] text-[72px]"
          aria-hidden="true"
        >
          ⚡
        </span>

        <h1 className="mb-2 font-display text-[32px] font-[800] text-[var(--t1)]">
          오늘의 학습이 완료됐어요
        </h1>
        <p className="mb-8 font-english text-[16px] italic text-[var(--t2)]">
          {totalWords}개의 단어와 함께한 {minutes}분의 깊은 시간
        </p>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <Stat value={totalWords} label="학습한 단어" />
          <Stat value={`${minutes}m`} label="학습 시간" />
          <Stat value={`${accuracy}%`} label="정확도" />
        </div>

        {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
        {recommendation && (
          <div className="mb-8 text-left">
            <NextActionCard
              recommendation={recommendation}
              prelude="잘 마쳤어요. 다음으로 무엇을 해볼까요?"
            />
          </div>
        )}

        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t2)] no-underline transition-colors hover:border-[var(--p)] hover:text-[var(--p)]"
        >
          스크립트로 돌아가기
        </Link>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
      <p className="mb-1.5 font-display text-[32px] font-[800] tabular-nums leading-none text-[var(--t1)]">
        {value}
      </p>
      <p className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
        {label}
      </p>
    </div>
  )
}
