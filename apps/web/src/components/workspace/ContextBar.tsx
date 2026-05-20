// apps/web/src/components/workspace/ContextBar.tsx

'use client'

import { CEFRBadge } from '@/components/library/CEFRBadge'
import type { LibraryText } from '@/types/library'
import { ArrowLeft, Bookmark, BookOpen, Focus, Info, Type } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { TypePopover } from './TypePopover'

interface ContextBarProps {
  text: LibraryText
  /** 책 단위 컨텍스트 — 표시할 chapter 라벨 (없으면 부제 숨김) */
  chapterLabel?: string
  isBookmarked: boolean
  onToggleBookmark: () => void
  onToggleInsight: () => void
  onToggleFocus: () => void
  isFocusMode: boolean
}

export function ContextBar({
  text,
  chapterLabel,
  isBookmarked,
  onToggleBookmark,
  onToggleInsight,
  onToggleFocus,
  isFocusMode,
}: ContextBarProps) {
  const [isTypeOpen, setIsTypeOpen] = useState(false)

  const showPageIndicator = text.totalPages > 1
  const progress = Math.max(0, Math.min(100, text.progressPercent))

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-[20px] transition-all duration-[var(--dur-slower)] ${
        isFocusMode
          ? 'bg-[var(--reading-bg)]/60'
          : 'bg-[var(--reading-bg)]/88 shadow-[0_1px_0_var(--bd)]'
      } `}
    >
      <div
        className={`mx-auto flex max-w-[1080px] items-center gap-3.5 px-6 transition-[padding] duration-[var(--dur-slower)] md:gap-4 md:px-8 ${
          isFocusMode ? 'py-1.5' : 'py-2.5'
        } `}
      >
        {/* Back Button */}
        <Link
          href="/library/books"
          aria-label="라이브러리로 돌아가기"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
        </Link>

        {/* Cover */}
        <div
          className={`flex shrink-0 items-center justify-center rounded-[var(--r-sm)] shadow-[0_2px_8px_rgba(0,0,0,0.14)] ring-1 ring-black/5 transition-all duration-[var(--dur-slower)] ${
            isFocusMode ? 'h-8 w-6' : 'h-11 w-8'
          } `}
          style={{
            background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
          }}
          aria-hidden="true"
        >
          <BookOpen size={14} strokeWidth={1.5} className="text-white/90" />
        </div>

        {/* Title block */}
        <div className="min-w-0 flex-1">
          {!isFocusMode && (text.author || chapterLabel) && (
            <div className="mb-0.5 flex items-center gap-1.5 font-display text-[10.5px] font-[600] uppercase tracking-[0.08em] text-[var(--t3)]">
              {text.author && (
                <span className="truncate text-[var(--t2)]">{text.author}</span>
              )}
              {text.author && chapterLabel && (
                <span className="text-[var(--t4)]" aria-hidden="true">
                  ·
                </span>
              )}
              {chapterLabel && <span className="shrink-0">{chapterLabel}</span>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1
              className={`min-w-0 truncate font-english leading-tight text-[var(--t1)] transition-[font-size] duration-[var(--dur-slower)] ${
                isFocusMode
                  ? 'text-[14px] font-[600]'
                  : 'text-[17px] font-[600] tracking-[-0.005em] md:text-[18px]'
              } `}
            >
              {text.title}
            </h1>
            {!isFocusMode && (
              <span className="shrink-0">
                <CEFRBadge level={text.cefrLevel} />
              </span>
            )}
          </div>
        </div>

        {/* Page Indicator — chapter 다중 page 일 때만 (현재 1) */}
        {showPageIndicator && (
          <div
            className={`flex shrink-0 items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1 font-mono text-[11px] font-[500] text-[var(--t2)] transition-opacity duration-[var(--dur-normal)] ${
              isFocusMode ? 'opacity-50' : 'opacity-100'
            } `}
          >
            <span className="inline-block h-1 w-1 rounded-full bg-[var(--p)]" aria-hidden="true" />
            <span>
              <strong className="font-[700] text-[var(--t1)]">{text.currentPage}</strong>
              <span className="text-[var(--t4)]"> / </span>
              {text.totalPages}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Bookmark */}
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
            aria-pressed={isBookmarked}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
              isBookmarked
                ? 'bg-[var(--active-light)] text-[var(--active)]'
                : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
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
              type="button"
              onClick={() => setIsTypeOpen((o) => !o)}
              aria-label="타이포 설정"
              aria-expanded={isTypeOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <Type size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {isTypeOpen && <TypePopover onClose={() => setIsTypeOpen(false)} />}
          </div>

          {/* Insight */}
          <button
            type="button"
            onClick={onToggleInsight}
            aria-label="인사이트 패널"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 animate-[pulse-soft_4s_ease-in-out_infinite] rounded-full bg-[var(--active)]"
              aria-hidden="true"
            />
          </button>

          {/* Divider */}
          <span className="mx-1 hidden h-5 w-px bg-[var(--bd)] md:inline-block" aria-hidden="true" />

          {/* Focus */}
          <button
            type="button"
            onClick={onToggleFocus}
            aria-label="집중 모드"
            aria-pressed={isFocusMode}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
              isFocusMode
                ? 'bg-[var(--p-light)] text-[var(--p)]'
                : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
            } `}
          >
            <Focus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Bottom progress bar — Implicit Progress */}
      <div
        className={`relative h-[2px] w-full bg-[var(--bd)]/40 transition-opacity duration-[var(--dur-slower)] ${
          isFocusMode ? 'opacity-30' : 'opacity-100'
        }`}
        role="progressbar"
        aria-label="읽기 진행률"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[var(--p)] to-[var(--p-hover)] transition-[width] duration-[var(--dur-slow)] ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  )
}
