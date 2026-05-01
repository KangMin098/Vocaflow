// apps/web/src/components/home/HubHero.tsx

import { StatCard } from '@/components/dashboard/StatCard'
import { ArrowRight, Flame } from 'lucide-react'
import Link from 'next/link'

interface HubHeroProps {
  userName: string
  streak: number
  reviewCount: number
  todayCount: number
  accuracy: number
}

export function HubHero({ userName, streak, reviewCount, todayCount, accuracy }: HubHeroProps) {
  const hasReview = reviewCount > 0

  return (
    <header className="relative rounded-[var(--r-2xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] px-6 py-8 text-[var(--ti)] shadow-[var(--sh-md)] md:px-10 md:py-10">
      {/* 상단: 좌(인사+Streak) | 우(Today CTA) */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* 좌측: 인사 + Streak */}
        <div className="flex flex-col gap-2">
          <span className="font-display text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80 md:text-[14px]">
            다시 오셨네요
          </span>

          <h1 className="font-display text-[28px] font-[800] leading-[1.1] md:text-[40px]">
            안녕하세요, {userName}님
          </h1>

          <p className="flex items-center gap-1.5 font-body text-[14px] opacity-90 md:text-[16px]">
            <Flame size={16} className="shrink-0 text-[var(--active)]" aria-hidden="true" />
            <span>
              <strong className="font-[700]">{streak}일</strong> 연속 학습 중이에요
            </span>
          </p>
        </div>

        {/* 우측: Today's Review CTA */}
        <Link
          href={hasReview ? '/flashcard?mode=review' : '/text'}
          aria-label={hasReview ? `오늘의 복습 ${reviewCount}개 시작` : '새 단어 추가하기'}
          className="focus-visible:ring-[var(--ti)]/60 inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-6 py-3 font-display text-[15px] font-[700] text-[var(--p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--p)] active:scale-[0.97]"
        >
          <span>{hasReview ? '오늘의 복습' : '새 단어 추가'}</span>
          {hasReview && (
            <span className="inline-flex h-[24px] min-w-[24px] items-center justify-center rounded-[var(--r-full)] bg-[var(--p)] px-1.5 text-[12px] font-[700] tabular-nums text-[var(--ti)]">
              {reviewCount}
            </span>
          )}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {/* 하단: inline Stats 3분할 */}
      <div className="border-[var(--ti)]/20 mt-7 grid grid-cols-3 gap-4 border-t pt-5 md:mt-9 md:gap-8">
        <StatCard variant="inline" label="오늘 학습" value={todayCount} />
        <StatCard variant="inline" label="연속 일수" value={`${streak}일`} />
        <StatCard variant="inline" label="전체 정확도" value={`${accuracy}%`} />
      </div>
    </header>
  )
}
