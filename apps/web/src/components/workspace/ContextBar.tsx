// apps/web/src/components/workspace/ContextBar.tsx

'use client'

import { CEFRBadge } from '@/components/library/CEFRBadge'
import type { LibraryText } from '@/types/library'
import { ArrowLeft, Bookmark, BookOpen, Focus, Info, MoreHorizontal, Type } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { TypePopover } from './TypePopover'

interface ContextBarProps {
  text: LibraryText
  isBookmarked: boolean
  onToggleBookmark: () => void
  onToggleInsight: () => void
  onToggleFocus: () => void
  isFocusMode: boolean
}

export function ContextBar({
  text,
  isBookmarked,
  onToggleBookmark,
  onToggleInsight,
  onToggleFocus,
  isFocusMode,
}: ContextBarProps) {
  const [isTypeOpen, setIsTypeOpen] = useState(false)

  // 진행률 계산: 10개 점 (10% 단위)
  const filledDots = Math.floor(text.progressPercent / 10)
  const partialDot = text.progressPercent % 10 >= 5

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-[20px] transition-all duration-[var(--dur-slower)] ${
        isFocusMode
          ? 'bg-[var(--reading-bg)]/60 border-transparent'
          : 'bg-[var(--reading-bg)]/85 border-[var(--bd)]'
      } `}
    >
      <div
        className={`mx-auto flex max-w-[1080px] items-center gap-4 transition-[padding] duration-[var(--dur-slower)] ${isFocusMode ? 'px-8 py-2' : 'px-8 py-3.5'} `}
      >
        {/* Back Button */}
        <Link
          href="/library"
          aria-label="라이브러리로 돌아가기"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        </Link>

        {/* Cover Mini */}
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-all duration-[var(--dur-slower)] ${isFocusMode ? 'h-8 w-6' : 'h-11 w-8'} `}
          style={{
            background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
          }}
          aria-hidden="true"
        >
          <BookOpen size={14} strokeWidth={1.5} className="text-white/85" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate font-english font-[600] leading-tight text-[var(--t1)] transition-[font-size] duration-[var(--dur-slower)] ${isFocusMode ? 'text-[14px]' : 'text-[16px]'} `}
          >
            {text.title}
          </h1>
          {!isFocusMode && (
            <div className="mt-0.5 flex items-center gap-2 font-body text-[11px] text-[var(--t3)]">
              <CEFRBadge level={text.cefrLevel} />
              <span className="font-display font-[600] text-[var(--t2)]">{text.author}</span>
              <span className="text-[var(--t4)]">·</span>
              <span>Chapter 1</span>
            </div>
          )}
        </div>

        {/* Page Indicator */}
        <div
          className={`flex flex-shrink-0 items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1 font-mono text-[11px] font-[500] text-[var(--t2)] transition-opacity duration-[var(--dur-normal)] ${isFocusMode ? 'opacity-60' : 'opacity-100'} `}
        >
          <span className="inline-block h-1 w-1 rounded-full bg-[var(--p)]" aria-hidden="true" />
          <span>
            <strong className="font-[700] text-[var(--t1)]">{text.currentPage}</strong> /{' '}
            {text.totalPages}
          </span>
        </div>

        {/* Progress Dots */}
        <div className="flex flex-shrink-0 items-center gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => {
            const isFilled = i < filledDots
            const isPartial = i === filledDots && partialDot
            return (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full transition-all duration-[var(--dur-slow)]"
                style={{
                  background: isFilled
                    ? 'var(--p)'
                    : isPartial
                      ? 'linear-gradient(90deg, var(--p) 50%, var(--bg3) 50%)'
                      : 'var(--bg3)',
                }}
                aria-hidden="true"
              />
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 gap-1">
          {/* Bookmark */}
          <button
            onClick={onToggleBookmark}
            aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
            aria-pressed={isBookmarked}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isBookmarked
                ? 'border-[var(--active)]/25 bg-[var(--active-light)] text-[var(--active)]'
                : 'border-transparent bg-transparent text-[var(--t3)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
            } `}
          >
            <Bookmark
              size={16}
              strokeWidth={1.75}
              fill={isBookmarked ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>

          {/* Type */}
          <div className="relative">
            <button
              onClick={() => setIsTypeOpen((o) => !o)}
              aria-label="타이포 설정"
              aria-expanded={isTypeOpen}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
            >
              <Type size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {isTypeOpen && <TypePopover onClose={() => setIsTypeOpen(false)} />}
          </div>

          {/* Insight */}
          <button
            onClick={onToggleInsight}
            aria-label="인사이트 패널"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            {/* Notification dot */}
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 animate-[pulse-soft_4s_ease-in-out_infinite] rounded-full bg-[var(--active)]"
              aria-hidden="true"
            />
          </button>

          {/* Focus */}
          <button
            onClick={onToggleFocus}
            aria-label="집중 모드"
            aria-pressed={isFocusMode}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isFocusMode
                ? 'border-[var(--p)]/25 bg-[var(--p-light)] text-[var(--p)]'
                : 'border-transparent bg-transparent text-[var(--t3)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
            } `}
          >
            <Focus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {/* More */}
          <button
            aria-label="더보기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
