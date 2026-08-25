// apps/web/src/components/echo/ScoreCard.tsx
'use client'

import type { ComparisonScore } from '@/lib/echo/dtw-comparator'

interface Props {
  score: ComparisonScore
  feedback: string
  tone: 'great' | 'good' | 'fair' | 'try'
}

const TONE_COLOR: Record<Props['tone'], string> = {
  great: 'var(--success)',
  good: 'var(--p)',
  fair: 'var(--warning)',
  try: 'var(--t2)',
}

export function ScoreCard({ score, feedback, tone }: Props) {
  return (
    <section
      className="rounded-[var(--r-lg)] border bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
      style={{ borderColor: TONE_COLOR[tone] + '55' }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            overall
          </span>
          <span
            className="font-mono text-[48px] font-[800] leading-none tabular-nums"
            style={{ color: TONE_COLOR[tone] }}
          >
            {score.overall}
            <span className="ml-1 font-display text-[14px] font-[600] text-[var(--t2)]">/100</span>
          </span>
        </div>
        <p
          className="max-w-[60%] text-right font-body text-[13px] leading-snug italic"
          style={{ color: TONE_COLOR[tone] }}
        >
          {feedback}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Axis label="인토네이션" value={score.pitch} weight="40%" />
        <Axis label="강세" value={score.energy} weight="30%" />
        <Axis label="리듬" value={score.timing} weight="30%" />
      </div>
    </section>
  )
}

function Axis({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-md)] bg-[var(--bg2)] p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[10px] font-[700] uppercase tracking-wide text-[var(--t2)]">
          {label}
        </span>
        <span className="font-mono text-[9px] text-[var(--t2)]">{weight}</span>
      </div>
      <span className="font-mono text-[18px] font-[700] tabular-nums text-[var(--t1)]">
        {value}
      </span>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full bg-[var(--p)] transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${value}%` }}
          aria-hidden
        />
      </div>
    </div>
  )
}
