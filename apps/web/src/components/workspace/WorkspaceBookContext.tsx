// apps/web/src/components/workspace/WorkspaceBookContext.tsx
// IA G1 — Workspace 책 컨텍스트 표시 (breadcrumb + chapter nav 진입점)
//
// library_book_id 있는 texts row에만 표시. 사용자 직접 입력 텍스트는 변경 0.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { WorkspaceChapterNav } from './WorkspaceChapterNav';
import {
  CompleteChapterButton,
  type ChapterDisplayStatus,
} from './CompleteChapterButton';

export type ChapterStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'extracted'
  | 'conquered';

export interface BookContextChapter {
  textId: string;
  chapterIdx: number;
  chapterTitle: string | null;
  status: ChapterStatus;
}

interface WorkspaceBookContextProps {
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  cefrLevel: string | null;
  chapters: BookContextChapter[];
  currentChapterIdx: number;
  /** Phase 11.10 — 현재 chapter texts.id (완료 처리용) */
  currentTextId: string;
  /** Phase 11.10 — 현재 chapter status (완료 버튼 분기용) */
  currentChapterStatus: ChapterDisplayStatus;
}

export function WorkspaceBookContext({
  bookId,
  bookTitle,
  bookAuthor,
  chapters,
  currentChapterIdx,
  currentTextId,
  currentChapterStatus,
}: WorkspaceBookContextProps) {
  const [navOpen, setNavOpen] = useState(false);

  const currentIdx = chapters.findIndex((c) => c.chapterIdx === currentChapterIdx);
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1]! : null;
  const nextChapter = currentIdx < chapters.length - 1 ? chapters[currentIdx + 1]! : null;

  const completedCount = chapters.filter(
    (c) => c.status === 'completed' || c.status === 'extracted' || c.status === 'conquered',
  ).length;

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--bd)] bg-[var(--bg)]/95 px-5 py-1.5 backdrop-blur-sm"
      aria-label="책 컨텍스트"
    >
      {/* 좌측: 컴팩트 breadcrumb (BookVault › 책 › Chapter N · ✓N) */}
      <nav
        aria-label="breadcrumb"
        className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]"
      >
        <Link
          href="/my/books"
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-0.5 text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          aria-label="책 목록으로 돌아가기"
        >
          <ArrowLeft size={10} aria-hidden />
          BookVault
        </Link>
        <span className="shrink-0" aria-hidden>›</span>
        <Link
          href={`/my/books/${bookId}`}
          className="line-clamp-1 rounded-[var(--r-sm)] text-[var(--t2)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {bookTitle}
        </Link>
        <span className="shrink-0" aria-hidden>›</span>
        <span className="shrink-0 text-[var(--t2)]">Ch {currentChapterIdx}/{chapters.length}</span>
        {completedCount > 0 && (
          <span className="shrink-0 font-[700] text-[var(--learn-known)]">
            ✓{completedCount}
          </span>
        )}
      </nav>

      {/* 우측: chapter nav + 완료 버튼 (책 메타는 ContextBar에 위임 — 중복 제거) */}
      <div className="flex shrink-0 items-center gap-1">
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
        <CompleteChapterButton
          textId={currentTextId}
          currentStatus={currentChapterStatus}
        />
      </div>

      {navOpen && (
        <WorkspaceChapterNav
          bookTitle={bookTitle}
          bookAuthor={bookAuthor}
          chapters={chapters}
          currentChapterIdx={currentChapterIdx}
          onClose={() => setNavOpen(false)}
        />
      )}
    </header>
  );
}

function ChapterNavButton({
  chapter,
  direction,
  label,
}: {
  chapter: BookContextChapter | null;
  direction: 'prev' | 'next';
  label: string;
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;

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
    );
  }

  return (
    <Link
      href={`/text/${chapter.textId}?mode=read`}
      aria-label={`${label} — Chapter ${chapter.chapterIdx}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <Icon size={14} aria-hidden />
    </Link>
  );
}
