// apps/web/src/components/workspace/UnifiedHeader.tsx
// v06.42 — 컴팩트 2-행 sticky header (breadcrumb 제거로 중복 해소).
//
//   Row A — 표지 + 제목 + 인라인 메타(CEFR·작가·Ch.N/total·✓N·단어장칩) + 액션(북마크·타이포·집중 + chapter nav + 완료)
//   Row B — ModePills (학습 도구)
//
// 중복/불필요 제거: breadcrumb 행 삭제(책제목·Chapter 중복 → 제목 1회·Ch.N/total 1회),
//   insight 아이콘 + 더보기(...) 버튼 제거(단어장 칩이 insight 트리거), back 은 화살표 1개.

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
  Layers,
  List,
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
  arcadeHref: string
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
  arcadeHref,
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
      {/* ━━━ Row A — 정체성 + 액션 (단일 행) ━━━
          breadcrumb 제거 → 책제목/챕터 중복 해소(제목 1회·Ch.N/total 1회), back 은 화살표로,
          insight·더보기 중복 아이콘 제거(단어장 칩이 insight 트리거). */}
      <div
        className={`mx-auto flex w-full max-w-[1080px] items-center gap-3 px-5 transition-[padding] duration-[var(--dur-slower)] sm:px-8 ${
          isFocusMode ? 'py-1' : 'py-1.5'
        }`}
      >
        {/* Back — 책(chapter context) 또는 라이브러리로.
            ⚠ /my/books/[bookId] 는 학습 재개 redirect 라우트 → /text 로 즉시 bounce (back 무효).
            도서 개요(챕터 그리드·단어장)로 가려면 /library/books/[bookId]?preview=1
            (preview=1 이 enroll 재개 redirect 우회 — page.tsx skipEnrollRedirect). */}
        <Link
          href={hasChapterContext ? `/library/books/${book.id}?preview=1` : '/text'}
          aria-label={hasChapterContext ? '책으로 돌아가기' : '라이브러리로 돌아가기'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-transparent text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        </Link>

        {/* Cover Mini */}
        <div
          className={`flex shrink-0 items-center justify-center rounded-[var(--r-sm)] shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-all duration-[var(--dur-slower)] ${
            isFocusMode ? 'h-7 w-5' : 'h-9 w-7'
          }`}
          style={{
            background: `linear-gradient(135deg, ${text.coverGradient.from} 0%, ${text.coverGradient.to} 100%)`,
          }}
          aria-hidden
        >
          <BookOpen size={13} strokeWidth={1.5} className="text-white/85" />
        </div>

        {/* Identity — 제목 + 인라인 메타 (단일 행) */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1
            className={`max-w-[45%] shrink-0 truncate font-english font-[600] leading-tight text-[var(--t1)] ${
              isFocusMode ? 'text-[14px]' : 'text-[15px]'
            }`}
          >
            {hasChapterContext ? book.title : text.title}
          </h1>
          {!isFocusMode && (
            <div className="flex min-w-0 items-center gap-2 font-body text-[11px] text-[var(--t2)]">
              <CEFRBadge level={(book?.cefrLevel ?? text.cefrLevel) as CEFRLevel} />
              {(book?.author ?? text.author) && (
                <span className="hidden truncate font-display font-[600] text-[var(--t2)] md:inline">
                  {book?.author ?? text.author}
                </span>
              )}
              {hasChapterContext && (
                <>
                  <span className="text-[var(--t2)]" aria-hidden>·</span>
                  <span className="shrink-0 font-mono tabular-nums text-[var(--t2)]">
                    Ch.{currentChapterIdx}/{totalChapters}
                  </span>
                  {completedCount > 0 && (
                    <span className="shrink-0 font-mono font-[700] tabular-nums text-[var(--learn-known)]">
                      ✓{completedCount}
                    </span>
                  )}
                  {bookWordSetStats && bookWordSetStats.total > 0 && (
                    <button
                      type="button"
                      onClick={onToggleInsight}
                      aria-label={`챕터 단어장 ${bookWordSetStats.subscribed} / ${bookWordSetStats.total} — 학습 인사이트 열기`}
                      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 font-mono text-[11px] font-[700] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
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
            className={`hidden shrink-0 items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1 font-mono text-[11px] font-[500] text-[var(--t2)] transition-opacity duration-[var(--dur-normal)] sm:flex ${
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
          <div className="hidden shrink-0 items-center gap-[3px] md:flex">
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

        {/* Actions toolbar — 북마크 · 타이포 · 집중 (insight·더보기 중복 제거) */}
        <div role="toolbar" aria-label="액션" className="flex shrink-0 items-center gap-0.5">
          {/* Bookmark */}
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
            aria-pressed={isBookmarked}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isBookmarked
                ? 'border-[var(--active)]/25 bg-[var(--active-light)] text-[var(--active)]'
                : 'border-transparent bg-transparent text-[var(--t2)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-transparent text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
            >
              <Type size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {isTypeOpen && <TypePopover onClose={() => setIsTypeOpen(false)} />}
          </div>

          {/* Focus */}
          <button
            type="button"
            onClick={onToggleFocus}
            aria-label="집중 모드"
            aria-pressed={isFocusMode}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border transition-all duration-[var(--dur-normal)] ${
              isFocusMode
                ? 'border-[var(--p)]/25 bg-[var(--p-light)] text-[var(--on-p-tint)]'
                : 'border-transparent bg-transparent text-[var(--t2)] hover:border-[var(--bd)] hover:bg-[var(--bg)] hover:text-[var(--t1)]'
            }`}
          >
            <Focus size={16} strokeWidth={1.75} aria-hidden />
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
        arcadeHref={arcadeHref}
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
