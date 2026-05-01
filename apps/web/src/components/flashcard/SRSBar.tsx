// apps/web/src/components/flashcard/SRSBar.tsx

'use client'

import { formatNextReview } from '@/lib/srs/sm2'
import type { SRSRating, SRSState } from '@/types/flashcard'

interface SRSBarProps {
  visible: boolean
  srs: SRSState
  onJudge: (rating: SRSRating) => void
}

const SRS_OPTIONS: Array<{
  rating: SRSRating
  emoji: string
  label: string
  variant: 'again' | 'hard' | 'good' | 'easy'
  keyHint: string
}> = [
  { rating: 'again', emoji: '😅', label: '몰라요', variant: 'again', keyHint: '1' },
  { rating: 'hard', emoji: '🤔', label: '어려워요', variant: 'hard', keyHint: '2' },
  { rating: 'good', emoji: '😊', label: '기억나요', variant: 'good', keyHint: '3' },
  { rating: 'easy', emoji: '✨', label: '너무 쉬워요', variant: 'easy', keyHint: '4' },
]

const VARIANT_STYLES = {
  again: {
    border: 'border-[rgba(239,68,68,0.2)]',
    hover: 'hover:border-[var(--srs-1)] hover:bg-[var(--error-light)]',
    label: 'text-[var(--srs-1)]',
  },
  hard: {
    border: 'border-[rgba(245,158,11,0.2)]',
    hover: 'hover:border-[var(--srs-2)] hover:bg-[var(--active-light)]',
    label: 'text-[var(--srs-2)]',
  },
  good: {
    border: 'border-[rgba(34,197,94,0.2)]',
    hover: 'hover:border-[var(--srs-3)] hover:bg-[var(--success-light)]',
    label: 'text-[var(--srs-3)]',
  },
  easy: {
    border: 'border-[rgba(59,130,246,0.2)]',
    hover: 'hover:border-[var(--srs-4)] hover:bg-[var(--p-light)]',
    label: 'text-[var(--srs-4)]',
  },
}

export function SRSBar({ visible, srs, onJudge }: SRSBarProps) {
  return (
    <div
      className={`mt-6 grid w-full max-w-[540px] grid-cols-4 gap-2 transition-all duration-[var(--dur-slow)] ease-[var(--ease)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0'
      } `}
      aria-hidden={!visible}
      role="group"
      aria-label="SRS 평가"
    >
      {SRS_OPTIONS.map(({ rating, emoji, label, variant, keyHint }) => {
        const styles = VARIANT_STYLES[variant]
        return (
          <button
            key={rating}
            onClick={() => onJudge(rating)}
            className={`group/srs relative flex flex-col items-center gap-1.5 rounded-[var(--r-lg)] border bg-[var(--bg)] px-2 py-3.5 pb-3 text-center transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-[3px] hover:shadow-[var(--sh-lg)] active:scale-[0.96] ${styles.border} ${styles.hover} `}
            aria-label={`${label}, ${formatNextReview(rating, srs)}`}
          >
            <span
              className="absolute right-1.5 top-1 rounded border border-[var(--bd)] bg-[var(--bg2)] px-[5px] py-[1px] font-mono text-[9px] font-[700] text-[var(--t3)] opacity-50 transition-opacity group-hover/srs:opacity-100"
              aria-hidden="true"
            >
              {keyHint}
            </span>
            <span className="text-[22px] leading-none">{emoji}</span>
            <span className={`font-display text-[13px] font-[700] ${styles.label}`}>{label}</span>
            <span className="font-mono text-[10px] font-[500] text-[var(--t3)]">
              {formatNextReview(rating, srs)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
