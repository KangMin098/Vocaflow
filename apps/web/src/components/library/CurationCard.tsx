// apps/web/src/components/library/CurationCard.tsx

import type { CurationItem } from '@/types/library'
import { BookOpen, Clock, Star, Users } from 'lucide-react'
import Link from 'next/link'
import { CEFRBadge } from './CEFRBadge'

interface CurationCardProps {
  item: CurationItem
}

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)}K`
  return n.toString()
}

export function CurationCard({ item }: CurationCardProps) {
  return (
    <Link
      href={`/text/${item.id}?mode=read`}
      className="group flex flex-col rounded-[var(--r-lg)] text-[var(--t1)] no-underline transition-transform duration-[var(--dur-slow)] ease-[var(--ease)] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      {/* Cover */}
      <div
        className="relative mb-3.5 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[var(--r-lg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-shadow duration-[var(--dur-slow)] group-hover:shadow-[0_16px_32px_rgba(0,0,0,0.18)]"
        style={{
          background: `linear-gradient(135deg, ${item.coverGradient.from} 0%, ${item.coverGradient.to} 100%)`,
        }}
      >
        {/* CEFR Top Left */}
        <span className="absolute left-3 top-3">
          <CEFRBadge level={item.cefrLevel} />
        </span>

        {/* Cover Illustration */}
        <BookOpen className="h-1/2 w-1/2 text-white/85" strokeWidth={1.5} />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 font-english text-[17px] font-[600] leading-tight text-[var(--t1)]">
          {item.title}
        </h3>
        <p className="font-body text-[13px] font-[500] text-[var(--t2)]">{item.author}</p>

        {/* Rating */}
        <div className="mt-1 flex items-center gap-2.5 font-body text-[12px] text-[var(--t2)]">
          <span className="inline-flex items-center gap-1 text-[var(--active)]">
            <Star size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {item.rating.toFixed(1)}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Users size={12} strokeWidth={1.75} aria-hidden="true" />
            {formatCount(item.popularUsers)}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-0.5 flex items-center gap-3 font-body text-[11px] text-[var(--t2)]">
          <span className="inline-flex items-center gap-1">
            <BookOpen size={11} strokeWidth={1.75} aria-hidden="true" />
            {formatCount(item.wordCount)}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} strokeWidth={1.75} aria-hidden="true" />약 {item.estimatedHours}시간
          </span>
        </div>
      </div>
    </Link>
  )
}
