// apps/web/src/components/flashcard/CompletionState.tsx

'use client'

import { Clock, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import type { ContentRef } from '@/lib/content/content-ref'
import type { RecommendedAction } from '@/lib/recommend/types'
import { useRecordGameScore } from '@/lib/scores/record-score'
import type { SessionStats } from '@/types/flashcard'

interface CompletionStateProps {
  stats: SessionStats
  /** 세션 종료 시 복귀 경로 — 페이지가 ?from/스코프로 계산 (스코프 진입 시 단어 id 오용 방지). */
  backHref: string
  onRestart: () => void
  /** 무엇으로 학습했나 — scores 콘텐츠 귀속(없으면 자료 미상으로 남는다). */
  content?: ContentRef
  /** §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) — 부모가 주입 */
  recommendation?: RecommendedAction
}

export function CompletionState({
  stats,
  backHref,
  onRestart,
  content,
  recommendation,
}: CompletionStateProps) {
  const totalMinutes = Math.round(stats.durationSeconds / 60)

  // 내일 다시 만날 카드 = again + hard 평가 받은 카드
  const tomorrowCount = stats.ratingCounts.again + stats.ratingCounts.hard

  // 게임 세션 점수 적재 (scores) — 완료 화면 1회. learning_records(단어별)와 별개.
  const totalRated =
    stats.ratingCounts.again +
    stats.ratingCounts.hard +
    stats.ratingCounts.good +
    stats.ratingCounts.easy
  const correctCount = stats.ratingCounts.good + stats.ratingCounts.easy
  useRecordGameScore({
    module: 'flashcard',
    score: correctCount,
    totalQuestions: stats.totalCards,
    correctCount,
    accuracy: totalRated > 0 ? Math.round((correctCount / totalRated) * 100) : 0,
    durationSeconds: stats.durationSeconds,
    content,
    metadata: {
      ratingCounts: stats.ratingCounts,
      honestyScore: stats.honestyScore,
      difficultCount: stats.difficultWords.length,
    },
  })

  return (
    <section className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[600px] text-center">
        <span
          className="mb-6 inline-block animate-[celebrate_1s_var(--ease-spring)] text-[72px]"
          aria-hidden="true"
        >
          ✨
        </span>

        <h1 className="mb-2 font-display text-[32px] font-[800] text-[var(--t1)]">
          오늘의 학습이 완료됐어요
        </h1>
        <p className="mb-8 font-english text-[16px] italic text-[var(--t2)]">
          {stats.totalCards}개의 단어와 함께한 {totalMinutes}분의 깊은 시간
        </p>

        {/* 통계 3-카드 */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          <CompletionStat value={stats.totalCards} label="학습한 단어" />
          <CompletionStat value={`${totalMinutes}m`} label="학습 시간" />
          <CompletionStat value={tomorrowCount} label="내일 다시" />
        </div>

        {/* 어려웠던 단어 */}
        {stats.difficultWords.length > 0 && (
          <div className="mb-8">
            <SectionTitle>어려웠던 단어</SectionTitle>
            <div className="flex flex-col gap-2">
              {stats.difficultWords.map((dw) => (
                <Link
                  key={dw.word.id}
                  href={`/flashcard?word=${dw.word.id}`}
                  className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 text-left no-underline transition-all duration-[var(--dur-normal)] hover:translate-x-0.5 hover:border-[var(--p)] hover:shadow-[var(--sh-sm)]"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--error-light)] font-display text-[11px] font-[800] text-[var(--error-ink)]">
                    {dw.attemptCount}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-english text-[16px] font-[600] text-[var(--t1)]">
                      {dw.word.text}
                    </span>
                    <span className="block font-body text-[12px] text-[var(--t2)]">
                      {dw.word.meaning}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-[var(--t2)]">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 다음 만남 */}
        <div className="mb-8 text-left">
          <SectionTitle>다음 만남</SectionTitle>
          <div className="rounded-[var(--r-lg)] border border-[rgba(59,130,246,0.2)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--p)] text-white">
                <Clock size={20} strokeWidth={2} aria-hidden="true" />
              </span>
              <p className="font-english text-[15px] italic leading-relaxed text-[var(--t1)]">
                <strong className="font-display font-[700] not-italic text-[var(--p)]">
                  {tomorrowCount}개
                </strong>
                의 단어가 내일 오전에 다시 만나러 와요.
                <br />
                기억이 안정될 때까지 함께해요.
              </p>
            </div>
          </div>
        </div>

        {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
        {recommendation && (
          <div className="mb-8 text-left">
            <NextActionCard
              recommendation={recommendation}
              prelude="오늘의 학습이 끝났어요. 다음으로 무엇을 해볼까요?"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--t1)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)]"
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
            <span>다시 학습</span>
          </button>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-6 py-3 font-display text-[14px] font-[700] text-white no-underline shadow-[0_4px_12px_rgba(59,130,246,0.25)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.35)]"
            style={{
              background: 'linear-gradient(135deg, var(--p) 0%, var(--p-dark) 100%)',
            }}
          >
            <span>Workspace 돌아가기</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

function CompletionStat({ value, label }: { value: string | number; label: string }) {
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-left font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden="true" />
    </h3>
  )
}
