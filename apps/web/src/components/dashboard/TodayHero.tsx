// apps/web/src/components/dashboard/TodayHero.tsx
// 대시보드 Hero — 오늘 한 가지: 오늘 목표 진행 + 시간대 인사 + 이어서 학습 CTA.
// Calm UI · Empathetic Feedback — 압박(빨강·미달 강조) 대신 "조금만 더" 격려.

'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface TodayHeroProps {
  userName?: string
  todayWords?: number
  goal?: number
}

export function TodayHero({ userName = '학습자', todayWords = 23, goal = 30 }: TodayHeroProps) {
  const hour = new Date().getHours()
  const greeting =
    hour < 6 ? '이른 아침이에요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : hour < 22 ? '좋은 저녁이에요' : '늦은 시간이네요'
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const pct = goal > 0 ? Math.min(100, Math.round((todayWords / goal) * 100)) : 0
  const remaining = Math.max(0, goal - todayWords)
  const done = remaining === 0
  const note = done
    ? '오늘 목표를 달성했어요 🎉 차분히 잘 해내고 있어요.'
    : `오늘 ${remaining}단어만 더 하면 목표예요. 천천히 가도 괜찮아요.`

  return (
    <header className="overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-gradient-to-br from-[var(--p-light)] via-[var(--bg2)] to-[var(--bg)] p-6 md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="font-mono text-[10px] font-[600] uppercase tracking-[0.15em] text-[var(--t3)]">
            {dateStr}
          </span>
          <h1 className="mt-1.5 font-display text-[24px] font-[800] leading-tight tracking-[-0.01em] text-[var(--t1)] md:text-[28px]">
            {greeting}, <span className="text-[var(--p)]">{userName}</span>님 👋
          </h1>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-[var(--t2)]">{note}</p>
        </div>

        <Link
          href="/hub"
          className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-[var(--r-md)] bg-[var(--p)] px-5 py-3 font-display text-[14px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all hover:bg-[var(--p-hover)] active:scale-[0.98]"
        >
          이어서 학습
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {/* 오늘 목표 진행 */}
      <div className="mt-6">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
            오늘 목표
          </span>
          <span className="font-display text-[13px] font-[700] tabular-nums text-[var(--t1)]">
            {todayWords}
            <span className="text-[var(--t3)]"> / {goal} 단어</span>
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`오늘 목표 진행 ${pct}%`}
        >
          <div
            className="h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)] ease-out"
            style={{
              width: `${pct}%`,
              background: done ? 'var(--success)' : 'var(--p)',
            }}
          />
        </div>
      </div>
    </header>
  )
}
