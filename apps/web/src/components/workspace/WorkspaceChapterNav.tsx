// apps/web/src/components/workspace/WorkspaceChapterNav.tsx
// IA G1 — Workspace chapter navigator (popover)

'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check, Clock, Circle, X } from 'lucide-react';
import type { BookContextChapter } from './WorkspaceBookContext';

interface WorkspaceChapterNavProps {
  bookTitle: string;
  bookAuthor: string | null;
  chapters: BookContextChapter[];
  currentChapterIdx: number;
  onClose: () => void;
}

export function WorkspaceChapterNav({
  bookTitle,
  bookAuthor,
  chapters,
  currentChapterIdx,
  onClose,
}: WorkspaceChapterNavProps) {
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [onClose]);

  // Phase 11.11 Issue 4 — popover 열릴 때 active chapter 시각 보장 + 첫 chapter 가시성
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // 활성 chapter가 있으면 nearest scroll, 없으면 top
    const activeEl = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } else {
      list.scrollTop = 0;
    }
  }, []);

  return (
    <div
      ref={ref}
      id="chapter-nav-popover"
      role="dialog"
      aria-label="장 목록"
      className="absolute right-5 top-[calc(100%+4px)] z-40 max-h-[60vh] w-[320px] overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-md)]"
    >
      <header className="flex items-start justify-between gap-2 border-b border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 font-display text-[13px] font-[700] text-[var(--t1)]">
            {bookTitle}
          </h2>
          {bookAuthor && (
            <p className="mt-0.5 line-clamp-1 font-body text-[11px] text-[var(--t3)]">
              {bookAuthor}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <X size={12} aria-hidden />
        </button>
      </header>

      <ul
        ref={listRef}
        role="list"
        className="overflow-y-auto p-1.5"
        style={{ maxHeight: 'calc(60vh - 56px)' }}
      >
        {chapters.map((ch) => {
          const active = ch.chapterIdx === currentChapterIdx;
          return (
            <li key={ch.textId}>
              <Link
                href={`/text/${ch.textId}?mode=read`}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={[
                  'group flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2',
                  'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
                  active
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]',
                ].join(' ')}
              >
                <ChapterStatusIcon status={ch.status} active={active} />
                <span
                  className={[
                    'font-mono text-[11px] tabular-nums',
                    active ? 'text-[var(--ti)] opacity-80' : 'text-[var(--t3)]',
                  ].join(' ')}
                >
                  {ch.chapterIdx.toString().padStart(2, '0')}
                </span>
                <span className="line-clamp-1 flex-1 font-display text-[12px] font-[600]">
                  {ch.chapterTitle ?? `Chapter ${ch.chapterIdx}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChapterStatusIcon({
  status,
  active,
}: {
  status: BookContextChapter['status'];
  active: boolean;
}) {
  const color = active ? 'text-[var(--ti)]' : 'text-[var(--t3)]';

  if (status === 'completed' || status === 'extracted' || status === 'conquered') {
    return <Check size={12} className={`shrink-0 ${color}`} aria-label="완료" />;
  }
  if (status === 'in_progress') {
    return <Clock size={12} className={`shrink-0 ${color}`} aria-label="진행 중" />;
  }
  return <Circle size={12} className={`shrink-0 ${color}`} aria-label="시작 전" />;
}
