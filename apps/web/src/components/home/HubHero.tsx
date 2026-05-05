// apps/web/src/components/home/HubHero.tsx
//
// Hub 페이지 최상단 영웅 헤더.
//
// Phase 3-2: useHubData() 훅으로부터 실데이터 자가 페치 — props 없음.
//   - displayName : user_profiles.display_name (한글 안전)
//   - streak      : user_stats.current_streak
//   - stats 3분할 : 오늘 학습 / 총 단어 / 정확도
//   - Today CTA   : reviewDueCount > 0 → /flashcard / 0 → /text/new (첫 학습)
//
// §17.3 추천 축 — Today CTA 1곳 (Hub Today CTA / FloatingSparkle / 세션 종료 후 3곳 중 1곳)

'use client'

import { ArrowRight, Flame, Sparkles, Sprout } from 'lucide-react'
import Link from 'next/link'

import { StatCard } from '@/components/dashboard/StatCard'
import { useHubData } from '@/hooks/useHubData'

// ────────────────────────────────────────────────────────────
// streak 메시지 (Empathetic Feedback — 0/1/2+ 격려형 분기)
// ────────────────────────────────────────────────────────────
function getStreakMessage(streak: number): { text: string; icon: typeof Flame } {
  if (streak === 0) return { text: '첫 학습을 시작해보세요', icon: Sprout }
  if (streak === 1) return { text: '학습을 시작했어요!', icon: Flame }
  return { text: `${streak}일 연속 학습 중이에요`, icon: Flame }
}

// ────────────────────────────────────────────────────────────
// Today CTA 분기
// ────────────────────────────────────────────────────────────
function getTodayCta(reviewDueCount: number): {
  href: string
  label: string
  badge: number | null
  ariaLabel: string
} {
  if (reviewDueCount > 0) {
    return {
      href: '/flashcard',
      label: '오늘의 복습',
      badge: reviewDueCount,
      ariaLabel: `오늘의 복습 ${reviewDueCount}개`,
    }
  }
  return {
    href: '/text/new',
    label: '첫 학습 시작하기',
    badge: null,
    ariaLabel: '첫 학습 시작하기',
  }
}

// ════════════════════════════════════════════════════════════
// HubHero
// ════════════════════════════════════════════════════════════
export function HubHero() {
  const { data, isLoading } = useHubData()

  // 빈 상태 — 데이터 도착 전에도 레이아웃 유지 (깜빡임 방지)
  const displayName = data?.user.displayName?.trim() ?? ''
  const streak = data?.stats.streak ?? 0
  const todayCount = data?.stats.todayWordCount ?? 0
  const totalWords = data?.stats.totalWords ?? 0
  const accuracy = data?.stats.accuracy ?? 0
  const reviewDueCount = data?.stats.reviewDueCount ?? 0

  const greeting = displayName ? `안녕하세요, ${displayName}님 👋` : '안녕하세요 👋'
  const { text: streakText, icon: StreakIcon } = getStreakMessage(streak)
  const cta = getTodayCta(reviewDueCount)

  return (
    <header className="relative rounded-[var(--r-2xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] px-6 py-8 text-[var(--ti)] shadow-[var(--sh-md)] md:px-10 md:py-10">
      {/* 상단: 좌(인사+Streak) | 우(Today CTA) */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* 좌측: 인사 + Streak */}
        <div className="flex flex-col gap-2">
          <span className="font-display text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80 md:text-[14px]">
            Welcome back
          </span>

          {isLoading ? (
            <span
              aria-hidden
              className="bg-[var(--ti)]/15 h-[44px] w-[280px] animate-pulse rounded-md md:h-[56px]"
            />
          ) : (
            <h1 className="font-display text-[28px] font-[800] leading-[1.1] md:text-[40px]">
              {greeting}
            </h1>
          )}

          <p className="flex items-center gap-1.5 font-body text-[14px] opacity-90 md:text-[16px]">
            <StreakIcon size={16} className="shrink-0 text-[var(--active)]" aria-hidden="true" />
            <span>{streakText}</span>
          </p>
        </div>

        {/* 우측: Today CTA */}
        <div className="flex flex-col items-start gap-1.5 md:items-end">
          <span className="inline-flex items-center gap-1 font-display text-[11px] font-[700] uppercase tracking-[0.10em] opacity-75">
            <Sparkles size={12} aria-hidden="true" />
            오늘의 추천
          </span>
          <Link
            href={cta.href}
            aria-label={cta.ariaLabel}
            className="focus-visible:ring-[var(--ti)]/60 inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-6 py-3 font-display text-[15px] font-[700] text-[var(--p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--p)] active:scale-[0.97]"
          >
            <span>{cta.label}</span>
            {cta.badge !== null && (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-[var(--r-full)] bg-[var(--active)] px-1.5 py-0.5 font-mono text-[11px] font-[700] tabular-nums text-[var(--ti)]">
                {cta.badge}
              </span>
            )}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 하단: inline Stats 3분할 */}
      <div className="border-[var(--ti)]/20 mt-7 grid grid-cols-3 gap-4 border-t pt-5 md:mt-9 md:gap-8">
        <StatCard variant="inline" label="오늘 학습" value={todayCount} unit="개" />
        <StatCard variant="inline" label="총 단어" value={totalWords} unit="개" />
        <StatCard variant="inline" label="정확도" value={accuracy} unit="%" />
      </div>
    </header>
  )
}
