// apps/web/src/components/library/reader/BookContentReader.tsx
// LCP v2.0 Phase 12.5 — 통합 Reader 컴포넌트
//
// admin-review 모드: 모든 chapter + 검수 도구 + 액션
// user-preview 모드: chapter 1만 + enroll CTA

'use client'

import {
  getChapterContent,
  getSampleWords,
  type ChapterContent,
  type ChapterListItem,
  type SampleWord,
} from '@/lib/library/reader-queries'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ChapterContentView } from './ChapterContent'
import { ChapterSidebar } from './ChapterSidebar'
import { WordLookupPopover } from './WordLookupPopover'
import { ChapterLevelWords } from './ChapterLevelWords'

export type ReaderMode = 'admin-review' | 'user-preview'

interface BookContentReaderProps {
  libraryBookId: string
  bookTitle: string
  bookAuthor: string | null
  cefrLevel: string | null
  totalWordCount: number
  chapters: ChapterListItem[]
  mode: ReaderMode
  /** 좌측 상단 footer slot — 모드별 액션 영역 (admin: 액션 버튼, user: enroll CTA) */
  footerSlot?: React.ReactNode
  /** v06.34 — admin 모드에서 chapter list 옆에 원본 소스 외부링크 표시 */
  source?: string | null
  sourceId?: string | null
}

export function BookContentReader({
  libraryBookId,
  bookTitle,
  bookAuthor,
  cefrLevel,
  totalWordCount,
  chapters,
  mode,
  footerSlot,
  source,
  sourceId,
}: BookContentReaderProps) {
  const [activeIdx, setActiveIdx] = useState(1)
  const [contentCache, setContentCache] = useState<Record<number, ChapterContent>>({})
  const [sampleCache, setSampleCache] = useState<Record<number, SampleWord[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 본문 단어 클릭 조회 팝오버 (자체 dict+lemma)
  const [lookup, setLookup] = useState<{ word: string; rect: DOMRect } | null>(null)

  // chapter 전환 시 팝오버 닫기 (stale rect 방지)
  useEffect(() => {
    setLookup(null)
  }, [activeIdx])

  // admin-review 토글
  const [showParagraphMarkers, setShowParagraphMarkers] = useState(false)
  const [showSampleWords, setShowSampleWords] = useState(false)
  // 내 레벨 맞춤 단어(Krashen i+1) 패널 토글 — 양 모드 공통
  const [showLevelWords, setShowLevelWords] = useState(false)

  const isLockedChapter = mode === 'user-preview' && activeIdx > 1

  // chapter 변경 시 fetch (캐시된 것은 skip)
  useEffect(() => {
    if (isLockedChapter) return
    if (contentCache[activeIdx]) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const client = createClient()
    getChapterContent(client, libraryBookId, activeIdx)
      .then((content) => {
        if (cancelled || !content) return
        setContentCache((prev) => ({ ...prev, [activeIdx]: content }))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'unknown')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeIdx, libraryBookId, contentCache, isLockedChapter])

  // sample words lazy fetch (admin-review + 토글 ON 시)
  useEffect(() => {
    if (mode !== 'admin-review' || !showSampleWords) return
    if (sampleCache[activeIdx]) return

    const client = createClient()
    getSampleWords(client, libraryBookId, activeIdx, 10)
      .then((words) => setSampleCache((prev) => ({ ...prev, [activeIdx]: words })))
      .catch(() => {})
  }, [activeIdx, libraryBookId, mode, showSampleWords, sampleCache])

  // 키보드 ← / → 네비
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && activeIdx > 1) {
        setActiveIdx((i) => i - 1)
      } else if (e.key === 'ArrowRight' && activeIdx < chapters.length) {
        if (mode === 'user-preview' && activeIdx >= 1) return
        setActiveIdx((i) => i + 1)
      }
    },
    [activeIdx, chapters.length, mode]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const activeContent = contentCache[activeIdx] ?? null
  const activeSamples = sampleCache[activeIdx] ?? []

  return (
    <>
    <article
      className="flex h-[calc(100vh-180px)] flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]"
      aria-label={`${bookTitle} 본문 reader`}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 font-display text-[16px] font-[700] text-[var(--t1)]">
            {bookTitle}
          </h2>
          <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t2)]">
            {bookAuthor ?? '저자 미상'}
            {cefrLevel && (
              <>
                <span className="mx-1.5 text-[var(--t5)]">·</span>
                <span className="font-mono text-[11px] text-[var(--t2)]">{cefrLevel}</span>
              </>
            )}
            <span className="mx-1.5 text-[var(--t5)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {totalWordCount.toLocaleString()} 단어
            </span>
            <span className="mx-1.5 text-[var(--t5)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {chapters.length}장
            </span>
          </p>
        </div>

        {/* 토글 — 내 레벨(양 모드) + admin 검수 토글 */}
        <div className="flex items-center gap-1.5">
          <ToggleButton
            active={showLevelWords}
            onToggle={() => setShowLevelWords((v) => !v)}
            label="🎯 익힐 단어"
            ariaLabel="이 챕터에서 익힐 단어 보기"
          />
          {mode === 'admin-review' && (
            <>
              <ToggleButton
                active={showParagraphMarkers}
                onToggle={() => setShowParagraphMarkers((v) => !v)}
                label="¶ 문단"
                ariaLabel="문단 마커 표시 토글"
              />
              <ToggleButton
                active={showSampleWords}
                onToggle={() => setShowSampleWords((v) => !v)}
                label="✦ 어휘"
                ariaLabel="LV 상위 어휘 하이라이트 토글"
              />
            </>
          )}
        </div>
      </header>

      {/* Body — sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <ChapterSidebar
          chapters={chapters}
          activeIdx={activeIdx}
          mode={mode}
          onSelect={setActiveIdx}
          source={source}
          sourceId={sourceId}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top toolbar — 이전/다음 버튼 */}
          <div className="flex items-center justify-between border-b border-[var(--bd)] bg-[var(--bg)] px-5 py-2">
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.max(1, i - 1))}
              disabled={activeIdx === 1}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="이전 장"
            >
              <ChevronLeft size={14} aria-hidden />
              이전
            </button>
            <span className="font-mono text-[11px] text-[var(--t2)]">
              {activeIdx} / {chapters.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.min(chapters.length, i + 1))}
              disabled={
                activeIdx === chapters.length || (mode === 'user-preview' && activeIdx >= 1)
              }
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="다음 장"
            >
              다음
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLockedChapter ? (
              <LockedChapterPanel />
            ) : loading ? (
              <ContentLoading />
            ) : error ? (
              <ContentError message={error} />
            ) : activeContent ? (
              <>
                <ChapterContentView
                  content={activeContent}
                  showParagraphMarkers={showParagraphMarkers}
                  sampleWords={showSampleWords ? activeSamples : []}
                  onWordClick={(word, rect) => setLookup({ word, rect })}
                />
                {showLevelWords && (
                  <ChapterLevelWords libraryBookId={libraryBookId} chapterIdx={activeIdx} />
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center font-body text-[12px] text-[var(--t2)]">
                본문 없음
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer slot — 모드별 액션 */}
      {footerSlot && (
        <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
          {footerSlot}
        </footer>
      )}
    </article>

    {lookup && (
      <WordLookupPopover
        surface={lookup.word}
        anchorRect={lookup.rect}
        onClose={() => setLookup(null)}
      />
    )}
    </>
  )
}

// ─────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────

function ToggleButton({
  active,
  onToggle,
  label,
  ariaLabel,
}: {
  active: boolean
  onToggle: () => void
  label: string
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={[
        'inline-flex min-h-[32px] items-center rounded-[var(--r-sm)] border px-2.5',
        'font-display text-[11px] font-[600]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        active
          ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function ContentLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--bg2)]" />
        <span className="font-mono text-[11px] text-[var(--t2)]">불러오는 중…</span>
      </div>
    </div>
  )
}

function ContentError({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-5">
      <div className="rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-4 py-3" role="alert">
        <p className="font-body text-[12px] text-[var(--learn-error)]">{message}</p>
      </div>
    </div>
  )
}

function LockedChapterPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="select-none text-4xl" aria-hidden>
        🔒
      </div>
      <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
        이 장은 학습 추가 후 열람 가능합니다
      </h3>
      <p className="max-w-md font-body text-[13px] leading-relaxed text-[var(--t2)]">
        지금은 1장만 미리 볼 수 있습니다. 내 학습에 추가하면 모든 장을 chapter 단위로 학습할 수
        있어요.
      </p>
    </div>
  )
}
