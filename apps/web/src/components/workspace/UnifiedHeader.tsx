// apps/web/src/components/workspace/UnifiedHeader.tsx
// Phase 11.16 — 통합 sticky header (WorkspaceBookContext + ContextBar 통합)
//
// 정보 단일화:
//   Row 1 — breadcrumb (BookVault › 책 제목 › Chapter N)
//   Row 2 — 책 정체성 (좌: 표지+제목+CEFR+작가+Ch X/N+✓N) + 액션 (우: 도구+chapter nav+완료)
//
// 중복 제거: 책 제목 / Chapter N / 뒤로 가기 각 1회만.

'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Focus,
  Info,
  Layers,
  List,
  MoreHorizontal,
  Type,
} from 'lucide-react'

import { CEFRBadge } from '@/components/library/CEFRBadge'
import type { LibraryText, CEFRLevel, ModeKey, ModeStatus } from '@/types/library'
import { ModePills } from './ModePills'
import { TypePopover } from './TypePopover'
import { WorkspaceChapterNav } from './WorkspaceChapterNav'
import {
  CompleteChapterButton,
  type ChapterDisplayStatus,
} from './CompleteChapterButton'
import type {
  BookContextChapter,
  ChapterStatus,
} from './WorkspaceBookContext'
import type {
  BookInfo,
  ChapterNavItem,
} from '@/app/(main)/text/[id]/text-content-context'

interface UnifiedHeaderProps {
  text: LibraryText
  /** library_book chapter일 때만 — 사용자 직접 입력 텍스트는 null */
  book: BookInfo | null
  chapters: ChapterNavItem[]
  currentChapterIdx: number | null
  currentTextId: string
  currentChapterStatus: ChapterDisplayStatus
  /** v06.30 — 챕터 단어장 구독 통계 (library_book only). 클릭 시 InsightPanel 열림 */
  bookWordSetStats: { subscribed: number; total: number } | null
  isBookmarked: boolean
  onToggleBookmark: () => void
  onToggleInsight: () => void
  onToggleFocus: () => void
  isFocusMode: boolean
  /** Phase 11.16.1 — ModePills 통합 (Row 3) */
  currentMode: ModeKey
  modeStatus: Record<ModeKey, ModeStatus>
  /** "단어" 모드 클릭 시 이동할 단어장(WordVault) href — 자료별로 page.tsx 에서 계산 */
  wordsHref: string
  /** "카드" 모드 클릭 시 이동할 Flashcard href — 자료 스코프(?set/?text) 포함 */
  flashcardHref: string
  /** "블리츠" 모드 클릭 시 이동할 WordBlitz href — 자료 스코프(?set/?text) 포함 */
  wordblitzHref: string
}

export function UnifiedHeader({
  text,
  book,
  chapters,
  currentChapterIdx,
  currentTextId,
  currentChapterStatus,
  bookWordSetStats,
  isBookmarked,
  onToggleBookmark,
  onToggleInsight,
  onToggleFocus,
  isFocusMode,
  currentMode,
  modeStatus,
  wordsHref,
  flashcardHref,
  wordblitzHref,
}: UnifiedHeaderProps) {
  const [isTypeOpen, setIsTypeOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const hasChapterContext = book != null && currentChapterIdx != null
  const totalChapters = chapters.length
  const completedCount = chapters.filter(
    (c) => c.status === 'completed' || c.status === 'extracted' || c.status === 'conquered',
  ).length

  const currentIdx = hasChapterContext
    ? chapters.findIndex((c) => c.chapterIdx === currentChapterIdx)
    : -1
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1]! : null
  const nextChapter =
    currentIdx >= 0 && currentIdx < chapters.length - 1 ? chapters[currentIdx + 1]! : null

  const filledDots = Math.floor(text.progressPercent / 10)
  const partialDot = text.progressPercent % 10 >= 5

  return (
    <header
      role="banner"
      className={`sticky top-0 z-30 flex flex-col border-b backdrop-blur-[20px] transition-all duration-[var(--dur-slower)] ${
        isFocusMode
          ? 'border-transparent bg-[var(--reading-bg)]/60'
          : 'border-[var(--bd)] bg-[var(--reading-bg)]/90'
      }`}
    >
      {/* ━━━ Row 1 — Breadcrumb (chapter context only · focus mode 시 hidden) ━━━ */}
      {hasChapterContext && !isFocusMode && (
        <nav
          aria-label="breadcrumb"
          className="mx-auto flex w-full max-w-[1080px] items-center gap-1.5 px-8 pt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]"
        >
          <Link
            href="/my/books"
            aria-label="책 목록으로 돌아가기"
            className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-0.5 text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ArrowLeft size={10} aria-hidden />
            BookVault
          </Link>
          <span className="shrink-0 text-[var(--t4)]" aria-hidden>›</span>
          <Link
            href={`/my/books/${book.id}`}
            className="line-clamp-1 max-w-[280px] rounded-[var(--r-sm)] text-[var(--t2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {book.title}
          </Link>
          <span className="shrink-0 text-[var(--t4)]" aria-hidden>›</span>
          <span className="shrink-0 text-[var(--t1)]">Chapter {currentChapterIdx}</span>
        </nav>
      )}

      {/* ━━━ Row 2 — Content + Actions ━━━ */}
      <div
        className={`mx-auto flex w-full max-w-[1080px] items-center gap-4 px-8 transition-[padding] duration-[var(--dur-slower)] ${
          isFocusMode ? 'py-1' : 'py-1.5'
        }`}
      >
        {/* Back Button — chapter context 없을 때만 노출 (chapter context 시 breadcrumb 사용) */}
        {!hasChapterContext && (
          <Link
            href="/my/texts"
            aria-label="라이브러리로 돌아가기"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          </Link>
        )}

        {/* Cover Mini */}
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-[var(--r-sm)] shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-all duration-[var(--dur-slower)] ${
            isFocusMode ? 'h-8 w-6' : 'h-10 w-7'
          }`}
          style={{
            background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
          }}
          aria-hidden
        >
          <BookOpen size={14} strokeWidth={1.5} className="text-white/85" />
        </div>

        {/* Info — 책/챕터 정체성 */}
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate font-english font-[600] leading-tight text-[var(--t1)] transition-[font-size] duration-[var(--dur-slower)] ${
              isFocusMode ? 'text-[14px]' : 'text-[16px]'
            }`}
          >
            {hasChapterContext ? book.title : text.title}
          </h1>
          {!isFocusMode && (
            <div className="mt-0.5 flex items-center gap-2 font-body text-[11px] text-[var(--t3)]">
              <CEFRBadge level={(book?.cefrLevel ?? text.cefrLevel) as CEFRLevel} />
              {(book?.author ?? text.author) && (
                <span className="font-display font-[600] text-[var(--t2)]">
                  {book?.author ?? text.author}
                </span>
              )}
              {hasChapterContext && (
                <>
                  <span className="text-[var(--t4)]" aria-hidden>·</span>
                  <span className="font-mono tabular-nums text-[var(--t2)]">
                    Ch.{currentChapterIdx}/{totalChapters}
                  </span>
                  {completedCount > 0 && (
                    <span className="font-mono font-[700] tabular-nums text-[var(--learn-known)]">
                      ✓{completedCount}
                    </span>
                  )}
                  {bookWordSetStats && bookWordSetStats.total > 0 && (
                    <button
                      type="button"
                      onClick={onToggleInsight}
                      aria-label={`챕터 단어장 ${bookWordSetStats.subscribed} / ${bookWordSetStats.total} 구독 — 학습 인사이트 열기`}
                      className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                    >
                      <Layers size={9} aria-hidden />
                      <span className="tabular-nums">
                        {bookWordSetStats.subscribed}/{bookWordSetStats.total}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Page Indicator — chapter context 아닐 때만 (사용자 직접 입력) */}
        {!hasChapterContext && text.totalPages > 1 && (
          <div
            className={`hidden flex-shrink-0 items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1 font-mono text-[11px] font-[500] text-[var(--t2)] transition-opacity duration-[var(--dur-normal)] sm:flex ${
              isFocusMode ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <span className="inline-block h-1 w-1 rounded-full bg-[var(--p)]" aria-hidden />
            <span>
              <strong className="font-[700] text-[var(--t1)]">{text.currentPage}</strong> /{' '}
              {text.totalPages}
            </span>
          </div>
        )}

        {/* Progress Dots — chapter context 아닐 때 (사용자 직접 입력 progress %) */}
        {!hasChapterContext && (
          <div className="hidden flex-shrink-0 items-center gap-[3px] md:flex">
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
                  aria-hidden
                />
              )
            })}
          </div>
        )}

        {/* Actions toolbar */}
        <div role="toolbar" aria-label="액션" className="flex flex-shrink-0 items-center gap-1">
          {/* Bookmark */}
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
            aria-pressed={isBookmarked}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isBookmarked
                ? 'border-[var(--active)]/25 bg-[var(--active-light)] text-[var(--active)]'
                : 'border-transparent bg-transparent text-[var(--t3)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
            }`}
          >
            <Bookmark
              size={16}
              strokeWidth={1.75}
              fill={isBookmarked ? 'currentColor' : 'none'}
              aria-hidden
            />
          </button>

          {/* Type */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTypeOpen((o) => !o)}
              aria-label="타이포 설정"
              aria-expanded={isTypeOpen}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
            >
              <Type size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {isTypeOpen && <TypePopover onClose={() => setIsTypeOpen(false)} />}
          </div>

          {/* Insight */}
          <button
            type="button"
            onClick={onToggleInsight}
            aria-label="인사이트 패널"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <Info size={16} strokeWidth={1.75} aria-hidden />
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 animate-[pulse-soft_4s_ease-in-out_infinite] rounded-full bg-[var(--active)]"
              aria-hidden
            />
          </button>

          {/* Focus */}
          <button
            type="button"
            onClick={onToggleFocus}
            aria-label="집중 모드"
            aria-pressed={isFocusMode}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isFocusMode
                ? 'border-[var(--p)]/25 bg-[var(--p-light)] text-[var(--p)]'
                : 'border-transparent bg-transparent text-[var(--t3)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
            }`}
          >
            <Focus size={16} strokeWidth={1.75} aria-hidden />
          </button>

          {/* More — desktop only */}
          <button
            type="button"
            aria-label="더보기"
            className="hidden h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)] md:inline-flex"
          >
            <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
          </button>

          {/* Chapter nav + 완료 — chapter context only */}
          {hasChapterContext && (
            <>
              <span className="mx-1 hidden h-4 w-px bg-[var(--bd)] md:inline-block" aria-hidden />

              <ChapterNavButton chapter={prevChapter} direction="prev" label="이전 장" />
              <button
                type="button"
                onClick={() => setNavOpen((v) => !v)}
                aria-expanded={navOpen}
                aria-controls="chapter-nav-popover"
                className="inline-flex min-h-[28px] items-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[11px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                <List size={11} aria-hidden />
                목차
              </button>
              <ChapterNavButton chapter={nextChapter} direction="next" label="다음 장" />
              <span className="ml-0.5" />
              <CompleteChapterButton textId={currentTextId} currentStatus={currentChapterStatus} />
            </>
          )}
        </div>
      </div>

      {/* ━━━ Row 3 — ModePills (학습 도구 선택) ━━━ */}
      <ModePills
        textId={currentTextId}
        currentMode={currentMode}
        modeStatus={modeStatus}
        isFocusMode={isFocusMode}
        wordsHref={wordsHref}
        flashcardHref={flashcardHref}
        wordblitzHref={wordblitzHref}
      />

      {hasChapterContext && navOpen && (
        <WorkspaceChapterNav
          bookTitle={book.title}
          bookAuthor={book.author}
          chapters={chapters.map<BookContextChapter>((c) => ({
            textId: c.textId,
            chapterIdx: c.chapterIdx,
            chapterTitle: c.chapterTitle,
            status: c.status as ChapterStatus,
          }))}
          currentChapterIdx={currentChapterIdx!}
          onClose={() => setNavOpen(false)}
        />
      )}
    </header>
  )
}

// ─────────────────────────────────────────────
// Sub
// ─────────────────────────────────────────────

function ChapterNavButton({
  chapter,
  direction,
  label,
}: {
  chapter: ChapterNavItem | null
  direction: 'prev' | 'next'
  label: string
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

  if (!chapter) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t5)] opacity-40"
      >
        <Icon size={14} aria-hidden />
      </button>
    )
  }

  return (
    <Link
      href={`/text/${chapter.textId}?mode=read`}
      aria-label={`${label} — Chapter ${chapter.chapterIdx}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <Icon size={14} aria-hidden />
    </Link>
  )
}
