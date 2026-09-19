// apps/web/src/components/flashcard/CompletionState.tsx
//
// 세션 완료 — 2026-09-19 재설계(DD-24): ✨ 72px + `celebrate` 1s 회전(모션 예산 초과) · 3열 통계 카드 ·
// 그라디언트 박스·버튼 · 「내일 오전에 다시 만나러 와요」(FSRS 가 정하지 않은 약속)를 걷고,
// 이 세션에서 다시 본 낱말들의 7일 기억 곡선 + 한 문장으로.

'use client'

import { RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import type { ContentRef } from '@/lib/content/content-ref'
import { sessionCurves } from '@/lib/flashcard/memory-line'
import type { SrsCard } from '@/lib/srs/fsrs'
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
  /** 이 세션에서 평가한 카드의 전·후(FSRS 카드가 있는 것만) — 7일 곡선 재료 */
  reviewed?: ReadonlyArray<{ before: SrsCard; after: SrsCard }>
}

export function CompletionState({
  stats,
  backHref,
  onRestart,
  content,
  recommendation,
  reviewed = [],
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

  // 7일 곡선 — 이 세션에서 다시 본 낱말들(FSRS 카드가 있는 것만). 허브 골든과 같은 문법.
  const curves = reviewed.length > 0 ? sessionCurves(reviewed, new Date()) : null
  const weekdayIdx = new Date(Date.now() + 9 * 3_600_000).getUTCDay()
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][weekdayIdx]
  const keptEnd = curves ? Math.round(curves.after[curves.after.length - 1]) : null

  return (
    <section className="flex flex-1 justify-center px-5 py-10 md:px-8">
      <div className="w-full max-w-[600px]">
        <p className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t3)]">
          플래시카드 · {stats.totalCards}단어 · {totalMinutes}분
        </p>
        {/* 비난도 축하도 아닌 한 문장(철학 3) — 폭죽·✨·회전 없음 */}
        <h1 className="mt-3 max-w-[22ch] break-keep font-ko-display text-[26px] font-[500] leading-[1.3] text-[var(--t1)] md:text-[32px]">
          {keptEnd === null
            ? '오늘 잘 마쳤어요.'
            : keptEnd >= 1
              ? `오늘 잘 마쳤어요. 다음 주 ${weekday}요일에도 약 ${keptEnd}개가 기억에 남아요.`
              : // 기대값이 1 미만 — "약 0개가 남아요" 대신 곡선이 말하는 사실(곧 다시 만나야 남는다)
                '오늘 잘 마쳤어요. 이 단어들은 며칠 안에 한 번 더 만나야 오래 남아요.'}
        </h1>

        {curves && <SessionCurve base={curves.base} after={curves.after} weekdayIdx={weekdayIdx} />}

        {tomorrowCount > 0 && (
          <p className="mt-4 break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
            「몰라요 · 어려워요」 로 고른{' '}
            <span className="font-mono tabular-nums text-[var(--t1)]">{tomorrowCount}</span>개는 가까운 날 다시
            만나요 — 날짜는 방금 고른 평가가 정했어요.
          </p>
        )}

        {/* 어려웠던 단어 — 괘선 목록 */}
        {stats.difficultWords.length > 0 && (
          <div className="mt-8">
            <SectionTitle>어려웠던 단어</SectionTitle>
            <ul className="divide-y divide-[var(--bd)]">
              {stats.difficultWords.map((dw) => (
                <li key={dw.word.id}>
                  <Link
                    // ⚠️ `/flashcard?word=<id>` 로 보내고 있었는데 **`/flashcard` 는
                    //    searchParams 를 한 줄도 읽지 않는다**(실측 2026-08-30). 실제로 그 낱말을
                    //    보여 줄 수 있는 곳으로 보낸다(`?q=` 는 `lib/wordvault/list-params` 가 읽는다).
                    href={`/wordvault/browse?q=${encodeURIComponent(dw.word.text)}`}
                    className="flex min-h-[44px] items-center gap-3 px-1 py-3 text-left no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                  >
                    {/* 시도 횟수 — **오류가 아니라 주의**다. 오류색(빨강)으로 세면 완료 화면이
                        성과를 비난하는 자리가 된다(절대금지 「정답률 빨간 글씨 압박」 · D6). */}
                    <span className="w-8 shrink-0 text-center font-mono text-[12px] font-[700] tabular-nums text-[var(--warning-ink)]">
                      {dw.attemptCount}회
                    </span>
                    <span className="min-w-0 flex-1">
                      <span lang="en" className="block font-english text-[16px] font-[600] text-[var(--t1)]">
                        {dw.word.text}
                      </span>
                      <span className="block font-body text-[12px] text-[var(--t2)]">{dw.word.meaning}</span>
                    </span>
                    <span aria-hidden="true" className="text-[var(--t2)]">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
        {recommendation && (
          <div className="mt-8 text-left">
            <NextActionCard
              recommendation={recommendation}
              prelude="오늘의 학습이 끝났어요. 다음으로 무엇을 해볼까요?"
            />
          </div>
        )}

        {/* Actions — 1차는 돌아가기(주묵), 다시 학습은 2차 */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-6 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-fast)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-[1px]"
          >
            <span>돌아가기</span>
            <span aria-hidden="true">→</span>
          </Link>
          <button
            onClick={onRestart}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-6 font-display text-[14px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-[1px]"
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
            <span>다시 학습</span>
          </button>
        </div>
      </div>
    </section>
  )
}

/**
 * 7일 곡선 — 허브 골든(「들어 올리는 곡선」)과 같은 문법: 점선 = 오늘 안 봤다면, 실선 = 오늘 본 뒤,
 * 사이의 옅은 `--memory-stable` 면 = 오늘 한 일이 남기는 몫. 정지 그래픽(학습 화면 모션 7종 밖 모션 없음).
 * 허브의 곡선은 `TodayStage` 안에 있어 가져오지 않았다(A5) — 공용 추출 후보(DECISIONS DD-24).
 */
function SessionCurve({ base, after, weekdayIdx }: { base: number[]; after: number[]; weekdayIdx: number }) {
  const W = 600
  const H = 150
  const PAD = 6
  const top = Math.max(1, ...after, ...base)
  const x = (d: number) => (d / (after.length - 1)) * W
  const y = (v: number) => PAD + (H - PAD * 2) * (1 - v / top)
  const path = (vs: number[]) => vs.map((v, d) => `${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path(after)} ${[...base]
    .reverse()
    .map((v, i) => `L${x(base.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')} Z`
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return (
    <figure className="mt-6">
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-[var(--t2)]">
        <span>오늘 본 단어 중 기억에 남을 수</span>
        <span aria-hidden>{Math.round(top)}</span>
      </div>
      <svg
        role="img"
        aria-label={`오늘 본 단어가 일주일 동안 기억에 남을 수 — 오늘 약 ${Math.round(after[0])}개, 일주일 뒤 약 ${Math.round(after[after.length - 1])}개`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1 block h-[120px] w-full md:h-[150px]"
      >
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="var(--bd)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="var(--memory-stable)" fillOpacity="0.16" />
        <path d={path(base)} fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <path d={path(after)} fill="none" stroke="var(--t1)" strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-[var(--t2)]" aria-hidden>
        {after.map((_, d) => (
          <span key={d}>{d === 0 ? '오늘' : days[(weekdayIdx + d) % 7]}</span>
        ))}
      </figcaption>
    </figure>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-left font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden="true" />
    </h3>
  )
}
