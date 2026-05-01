// apps/web/src/components/library/LibraryCard.tsx

import type { LibraryText } from '@/types/library'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { CEFRBadge } from './CEFRBadge'

interface LibraryCardProps {
  text: LibraryText
}

export function LibraryCard({ text }: LibraryCardProps) {
  const isComplete = text.progressPercent >= 100
  const isStarted = text.progressPercent > 0

  let progressLabel = '시작'
  let progressColor: string = 'var(--t3)'
  if (isComplete) {
    progressLabel = '완료'
    progressColor = 'var(--success)'
  } else if (isStarted) {
    progressLabel = `${text.progressPercent}%`
    progressColor = 'var(--p)'
  }

  return (
    <Link
      href={`/text/${text.id}?mode=read`}
      className="group flex flex-col text-[var(--t1)] no-underline transition-transform duration-[var(--dur-slow)] ease-[var(--ease)] hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      aria-label={`${text.title} - ${progressLabel}`}
    >
      {/* Cover */}
      <div
        className="relative mb-2.5 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[var(--r-md)] shadow-[0_4px_12px_rgba(0,0,0,0.10)] transition-shadow duration-[var(--dur-normal)] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
        style={{
          background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
        }}
      >
        <span className="absolute left-2 top-2">
          <CEFRBadge level={text.cefrLevel} />
        </span>

        <BookOpen className="h-[48%] w-[48%] text-white/85" strokeWidth={1.5} />

        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 backdrop-blur-sm">
          <div
            className="h-full transition-all duration-[var(--dur-slower)]"
            style={{
              width: `${text.progressPercent}%`,
              background: isComplete ? 'var(--success)' : 'var(--p)',
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <h3 className="line-clamp-2 font-english text-[15px] font-[600] leading-tight text-[var(--t1)]">
          {text.title}
        </h3>
        <p className="truncate font-body text-[12px] font-[500] text-[var(--t3)]">{text.author}</p>

        <div className="mt-1.5 flex items-center justify-between font-body text-[11px] text-[var(--t3)]">
          <span>{text.wordCount}단어</span>
          <span className="font-display font-[700] tabular-nums" style={{ color: progressColor }}>
            {progressLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}
