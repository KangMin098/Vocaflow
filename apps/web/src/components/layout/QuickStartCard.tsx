'use client'

import Link from 'next/link'

type Props = {
  pendingCount?: number
  todayGoal?: number
  todayDone?: number
}

export default function QuickStartCard({
  pendingCount = 12,
  todayGoal = 15,
  todayDone = 8,
}: Props) {
  const progress = todayGoal > 0 ? Math.min((todayDone / todayGoal) * 100, 100) : 0

  return (
    <Link
      href="/flashcard?mode=review"
      className="relative mx-3.5 mb-2 block w-[calc(100%-28px)] overflow-hidden rounded-[14px] px-4 py-3.5 text-left text-white transition-all duration-[220ms] hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(139,92,246,0.35)]"
      style={{
        background: 'linear-gradient(135deg, var(--combo) 0%, var(--streak) 100%)',
      }}
    >
      <span
        className="pointer-events-none absolute -right-[30%] -top-1/2 h-[200%] w-[80%]"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mb-2 flex items-center gap-2">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-85"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          오늘의 학습
        </span>
        <span className="ml-auto text-[14px] opacity-85">→</span>
      </div>

      <div
        className="relative z-10 mb-2.5 flex items-baseline gap-1.5 text-[14px] font-bold"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-[20px] font-extrabold" style={{ fontFamily: 'var(--font-mono)' }}>
          {pendingCount}
        </span>
        <span>단어 복습 대기</span>
      </div>

      <div className="relative z-10">
        <div className="mb-1.5 h-1 overflow-hidden rounded-[2px] bg-white/25">
          <div
            className="h-full rounded-[2px] bg-white/95 transition-all duration-[320ms]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className="text-[9px] font-semibold opacity-85"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          오늘 목표 {todayDone} / {todayGoal}
        </div>
      </div>
    </Link>
  )
}
