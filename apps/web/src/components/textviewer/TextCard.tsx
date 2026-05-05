// apps/web/src/components/textviewer/TextCard.tsx
//
// 사용자 입력 스크립트 카드 — TextViewer 허브 그리드용
// /library 의 LibraryCard 보다 컴팩트 + 자기 자산 강조 (정복 배지 + 진행률)

'use client'

import { Bookmark } from 'lucide-react'
import Link from 'next/link'

import { TextStatusBadge } from './TextStatusBadge'

import type { LibraryText } from '@/types/library'

interface TextCardProps {
  text: LibraryText
}

function relativeTimeKo(date: Date | null): string {
  if (!date) return '학습 시작 전'
  const diffMs = Date.now() - date.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  const diffD = diffH / 24
  if (diffH < 1) return '방금'
  if (diffH < 24) return `${Math.floor(diffH)}시간 전`
  if (diffD < 2) return '어제'
  if (diffD < 7) return `${Math.floor(diffD)}일 전`
  if (diffD < 14) return '1주일 전'
  if (diffD < 30) return `${Math.floor(diffD / 7)}주 전`
  return '오래 전'
}

export function TextCard({ text }: TextCardProps) {
  const lastStudied = relativeTimeKo(text.lastStudiedAt)

  return (
    <Link
      href={`/text/${text.id}`}
      aria-label={`${text.title} 학습 (${text.progressPercent}%)`}
      className="group flex flex-col rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:-translate-y-1 hover:border-[var(--p)] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
    >
      {/* Cover gradient */}
      <div
        className="relative h-24 rounded-t-[var(--r-lg)]"
        style={{
          background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
        }}
      >
        {/* Bookmark indicator */}
        {text.isBookmarked && (
          <span
            className="absolute right-2 top-2 rounded-full bg-white/20 p-1.5 backdrop-blur"
            aria-label="즐겨찾기"
          >
            <Bookmark
              size={11}
              strokeWidth={2.5}
              className="fill-white text-white"
              aria-hidden="true"
            />
          </span>
        )}

        {/* CEFR badge */}
        <span
          className="absolute bottom-2 left-2 rounded-[var(--r-sm)] bg-white/20 px-1.5 py-0.5 font-display text-[9px] font-[800] uppercase tracking-wider text-white backdrop-blur"
          aria-label={`레벨 ${text.cefrLevel}`}
        >
          {text.cefrLevel}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 font-english text-[14px] font-[600] leading-snug text-[var(--t1)]">
            {text.title}
          </h3>
          <TextStatusBadge text={text} />
        </div>

        {/* Author + category */}
        <p className="line-clamp-1 font-body text-[11px] text-[var(--t3)]">
          {text.author} · {text.category}
        </p>

        {/* Progress bar */}
        <div className="mt-auto pt-2">
          <div
            className="h-1 overflow-hidden rounded-full bg-[var(--bg3)]"
            role="progressbar"
            aria-valuenow={text.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-[var(--dur-normal)]"
              style={{
                width: `${text.progressPercent}%`,
                backgroundColor:
                  text.progressPercent >= 100 ? 'var(--success)' : 'var(--p)',
              }}
            />
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-[var(--t3)]">
            <span>{text.wordCount}단어</span>
            <span>{lastStudied}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
