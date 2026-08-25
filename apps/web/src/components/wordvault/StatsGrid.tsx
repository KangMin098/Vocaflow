// apps/web/src/components/wordvault/StatsGrid.tsx
// 통계 카드 4개 (Endowed Progress)

'use client'

import type { LucideIcon } from 'lucide-react'
import { BookOpen, Flame, Star, Target } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  iconColor: 'mastered' | 'known' | 'review' | 'fresh'
  trend: string
  value: string
  unit?: string
  label: string
}

const colorMap = {
  mastered: {
    bg: 'bg-learn-mastered-light',
    text: 'text-learn-mastered',
    glow: 'var(--learn-mastered)',
  },
  known: {
    bg: 'bg-learn-known-light',
    text: 'text-learn-known',
    glow: 'var(--learn-known)',
  },
  review: {
    bg: 'bg-learn-review-light',
    text: 'text-learn-review',
    glow: 'var(--learn-review)',
  },
  fresh: {
    bg: 'bg-learn-fresh-light',
    text: 'text-learn-fresh',
    glow: 'var(--learn-fresh)',
  },
}

function StatCard({ icon: Icon, iconColor, trend, value, unit, label }: StatCardProps) {
  const colors = colorMap[iconColor]

  return (
    <div className="hover:border-bd-strong relative overflow-hidden rounded-xl border border-bd bg-bg px-s-5 py-s-4 transition-all duration-normal hover:-translate-y-px hover:shadow-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[30px] -top-[30px] h-[100px] w-[100px] rounded-full opacity-10"
        style={{
          background: `radial-gradient(circle, ${colors.glow}, transparent)`,
          filter: 'blur(30px)',
        }}
      />

      <div className="mb-s-2 flex items-center justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${colors.bg} ${colors.text}`}
        >
          <Icon size={14} />
        </div>
        <span className="bg-learn-known-light text-learn-known rounded px-s-2 py-[4px] font-mono text-[11px] font-bold tabular-nums">
          {trend}
        </span>
      </div>

      <div className="mb-s-1 font-display text-[28px] font-extrabold tabular-nums leading-none tracking-[-0.03em] text-t1">
        {value}
        {unit && <span className="text-[18px] text-t3">{unit}</span>}
      </div>
      <div className="font-body text-xs font-medium text-t3">{label}</div>
    </div>
  )
}

export interface StatsGridProps {
  totalWords?: number
  masteredWords?: number
  todayReview?: number
  accuracy?: number
}

export function StatsGrid({
  totalWords = 342,
  masteredWords = 128,
  todayReview = 12,
  accuracy = 87,
}: StatsGridProps) {
  return (
    <div className="mb-s-5 grid grid-cols-1 gap-s-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={BookOpen}
        iconColor="mastered"
        trend="+12"
        value={totalWords.toLocaleString()}
        label="총 단어"
      />
      <StatCard
        icon={Star}
        iconColor="known"
        trend="+8"
        value={masteredWords.toLocaleString()}
        label="마스터 단어"
      />
      <StatCard
        icon={Flame}
        iconColor="review"
        trend="7일"
        value={todayReview.toString()}
        label="오늘 복습"
      />
      <StatCard
        icon={Target}
        iconColor="fresh"
        trend="+3%"
        value={accuracy.toString()}
        unit="%"
        label="평균 정확도"
      />
    </div>
  )
}
