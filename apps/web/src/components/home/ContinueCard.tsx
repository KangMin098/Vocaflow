// apps/web/src/components/home/ContinueCard.tsx

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ContinueCardProps {
  textId: string
  title: string
  preview: string
  progressPercent: number
  relativeTime: string
  moduleLabel: string
  wordCount?: number
}

export function ContinueCard({
  textId,
  title,
  preview,
  progressPercent,
  relativeTime,
  moduleLabel,
  wordCount,
}: ContinueCardProps) {
  const isComplete = progressPercent >= 100

  return (
    <Link
      href={`/text?id=${textId}`}
      aria-label={`${title} 이어서 학습 (${progressPercent}% 진행)`}
      className="group flex flex-col gap-0 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
    >
      {/* ① 제목 — 1순위 (Lora) */}
      <h3 className="mb-2 line-clamp-1 font-english text-[20px] font-[600] leading-tight text-[var(--t1)]">
        {title}
      </h3>

      {/* ② 메타 정보 — 작게 */}
      <div className="mb-4 flex items-center gap-2 font-body text-[12px] text-[var(--t3)]">
        {wordCount !== undefined && (
          <>
            <span>단어 {wordCount}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{relativeTime}</span>
        <span aria-hidden="true">·</span>
        <span>{moduleLabel}</span>
      </div>

      {/* ③ 미리보기 (Lora) */}
      <p className="mb-6 line-clamp-2 font-english text-[14px] leading-relaxed text-[var(--t2)]">
        {preview}
      </p>

      {/* ④ 진행률 바 + 퍼센트 (시선 중심) */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
          <div
            className={`h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)] ease-out ${isComplete ? 'bg-[var(--success)]' : 'bg-[var(--p)]'} `}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span
          className={`shrink-0 font-display text-[13px] font-[600] tabular-nums ${isComplete ? 'text-[var(--success)]' : 'text-[var(--p)]'} `}
        >
          {progressPercent}%
        </span>
      </div>

      {/* ⑤ CTA — 우하단 */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--p)] transition-all duration-[var(--dur-normal)] group-hover:gap-2">
          {isComplete ? '복습하기' : '이어하기'}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
