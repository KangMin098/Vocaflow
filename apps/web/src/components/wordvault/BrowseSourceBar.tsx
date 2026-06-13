// apps/web/src/components/wordvault/BrowseSourceBar.tsx
//
// 도서 단어장 Browse 컨텍스트 — 컴팩트 소스/챕터 바 (1행).
//   · 챕터 점프 드롭다운(모든 챕터 직행) + 이전/다음 + 위치/단어수
//   · 소스 바로가기: [본문] (워크스페이스 읽기) · [도서] (챕터 단어장 grid)
//
// 책 제목은 SessionFrame 리소스 브레드크럼이 이미 표시 → 여기선 반복 X (중복 제거).
// 기존 full-width <nav> 챕터 바 + 90+개 챕터 chip 폭발을 이 1행으로 대체.

'use client'

import Link from 'next/link'
import { BookOpen, ChevronLeft, ChevronRight, Library } from 'lucide-react'

interface ChapterRef {
  id: string
  chapterIdx: number
  title: string
  isCurrent: boolean
}

interface Props {
  bookId: string
  chapterIdx: number
  /** 사용자가 enroll 한 경우 현재 챕터 texts.id (본문 직링크) */
  currentTextId: string | null
  chapters: ChapterRef[]
  wordCount: number
  onGoToChapter: (chapter: { id: string; chapterIdx: number }) => void
}

export function BrowseSourceBar({
  bookId,
  chapterIdx,
  currentTextId,
  chapters,
  wordCount,
  onGoToChapter,
}: Props) {
  const idx = chapters.findIndex((c) => c.isCurrent)
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null
  const current = chapters[idx] ?? null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-r from-[var(--bg2)] to-[var(--bg)] px-2 py-1.5">
      {/* ── 챕터 네비게이터 ── */}
      <div className="flex min-w-0 items-center gap-1">
        <NavArrow
          dir="prev"
          disabled={!prev}
          label={prev ? `Chapter ${prev.chapterIdx}` : '이전 챕터 없음'}
          onClick={() => prev && onGoToChapter(prev)}
        />

        {/* 챕터 점프 드롭다운 — 모든 챕터 직행 (편의 핵심) */}
        <div className="relative min-w-0">
          <select
            aria-label="챕터 선택"
            value={current?.id ?? ''}
            onChange={(e) => {
              const ch = chapters.find((c) => c.id === e.target.value)
              if (ch) onGoToChapter(ch)
            }}
            className="h-8 max-w-[200px] cursor-pointer appearance-none truncate rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%2210%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23A1A1AA%22%20stroke-width=%222.5%22%3E%3Cpolyline%20points=%226%209%2012%2015%2018%209%22/%3E%3C/svg%3E')] bg-[right_9px_center] bg-no-repeat pl-2.5 pr-7 font-display text-[12.5px] font-[700] tracking-[-0.01em] text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Ch.{c.chapterIdx}
                {c.title ? ` · ${c.title}` : ''}
              </option>
            ))}
          </select>
        </div>

        <NavArrow
          dir="next"
          disabled={!next}
          label={next ? `Chapter ${next.chapterIdx}` : '다음 챕터 없음'}
          onClick={() => next && onGoToChapter(next)}
        />

        <span className="ml-1.5 shrink-0 font-mono text-[11px] font-[600] tabular-nums text-[var(--t3)]">
          {idx >= 0 ? idx + 1 : chapterIdx}/{chapters.length}
          <span className="mx-1 text-[var(--t4)]">·</span>
          <span className="text-[var(--t2)]">{wordCount.toLocaleString()}</span>단어
        </span>
      </div>

      {/* ── 소스 바로가기 ── */}
      <div className="flex shrink-0 items-center gap-1.5">
        {currentTextId && (
          <SourceLink
            href={`/text/${currentTextId}?mode=read`}
            icon={<BookOpen size={12} aria-hidden />}
            label="본문"
            title="이 챕터 본문 읽기"
            primary
          />
        )}
        <SourceLink
          href={`/library/books/${bookId}?preview=1`}
          icon={<Library size={12} aria-hidden />}
          label="도서"
          title="도서 단어장 전체 보기"
        />
      </div>
    </div>
  )
}

function NavArrow({
  dir,
  disabled,
  label,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {dir === 'prev' ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
    </button>
  )
}

function SourceLink({
  href,
  icon,
  label,
  title,
  primary,
}: {
  href: string
  icon: React.ReactNode
  label: string
  title: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--r-md)] px-3 font-display text-[12px] font-[700] transition-all ${
        primary
          ? 'bg-[#6366F1] text-white shadow-[var(--sh-xs)] hover:bg-[#4F46E5]'
          : 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}
