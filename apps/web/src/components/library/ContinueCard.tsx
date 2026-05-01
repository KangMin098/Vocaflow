// apps/web/src/components/library/ContinueCard.tsx

import type { LibraryText } from '@/types/library'
import { BookOpen, Clock, Play } from 'lucide-react'
import Link from 'next/link'
import { CEFRBadge } from './CEFRBadge'

interface ContinueCardProps {
  text: LibraryText
}

function relativeTime(date: Date | null): string {
  if (!date) return '시작 전'
  const diffMs = Date.now() - date.getTime()
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDay = Math.floor(diffHour / 24)

  if (diffHour < 1) return '방금'
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  return `${Math.floor(diffDay / 7)}주 전`
}

export function ContinueCard({ text }: ContinueCardProps) {
  return (
    <Link
      href={`/text/${text.id}?mode=read`}
      className="group flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-slow)] ease-[var(--ease)] hover:-translate-y-1 hover:shadow-[var(--sh-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      aria-label={`${text.title} — ${text.progressPercent}% 진행`}
    >
      {/* Body */}
      <div className="flex gap-4 p-5">
        {/* Cover */}
        <div
          className="flex h-[110px] w-20 flex-shrink-0 items-center justify-center rounded-[var(--r-md)] shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
          style={{
            background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
          }}
          aria-hidden="true"
        >
          <BookOpen className="h-6 w-6 text-white/80" strokeWidth={1.5} />
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* CEFR + Author */}
          <div className="flex items-center gap-2 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
            <CEFRBadge level={text.cefrLevel} />
            <span className="truncate">{text.author}</span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 font-english text-[18px] font-[600] leading-tight text-[var(--t1)]">
            {text.title}
          </h3>

          {/* Progress */}
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
              <div
                className="h-full rounded-full transition-all duration-[var(--dur-slower)]"
                style={{
                  width: `${text.progressPercent}%`,
                  background: `linear-gradient(90deg, var(--p), var(--p-dark))`,
                }}
              />
            </div>
            <span className="flex-shrink-0 font-display text-[12px] font-[700] tabular-nums text-[var(--t2)]">
              {text.progressPercent}%
            </span>
          </div>

          {/* Meta */}
          <div className="mt-1 flex items-center gap-3 font-body text-[12px] text-[var(--t3)]">
            <span className="inline-flex items-center gap-1">
              <BookOpen size={11} strokeWidth={1.75} aria-hidden="true" />
              {text.wordCount}단어
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} strokeWidth={1.75} aria-hidden="true" />
              {relativeTime(text.lastStudiedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div
        className="flex items-center justify-center gap-2 p-3 font-display text-[14px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)]"
        style={{
          background: 'linear-gradient(135deg, var(--p) 0%, var(--p-dark) 100%)',
        }}
      >
        <Play size={14} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
        <span>이어서 학습</span>
        <span className="inline-block transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  )
}
