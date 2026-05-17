// apps/web/src/components/library/reader/ChapterSidebar.tsx
// LCP v2.0 Phase 12.5 — Reader 사이드바 (chapter list)

'use client'

import type { ChapterListItem } from '@/lib/library/reader-queries'
import { Lock } from 'lucide-react'
import type { ReaderMode } from './BookContentReader'

interface ChapterSidebarProps {
  chapters: ChapterListItem[]
  activeIdx: number
  mode: ReaderMode
  onSelect: (idx: number) => void
}

export function ChapterSidebar({ chapters, activeIdx, mode, onSelect }: ChapterSidebarProps) {
  return (
    <nav
      className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-[var(--bd)] bg-[var(--bg2)]"
      aria-label="장 목록"
    >
      <div className="border-b border-[var(--bd)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
          목차
        </span>
      </div>

      <ul role="list" className="flex flex-col gap-0.5 p-2">
        {chapters.map((ch) => {
          const active = ch.chapter_idx === activeIdx
          const locked = mode === 'user-preview' && ch.chapter_idx > 1

          return (
            <li key={ch.chapter_idx}>
              <button
                type="button"
                onClick={() => !locked && onSelect(ch.chapter_idx)}
                disabled={locked}
                aria-current={active ? 'page' : undefined}
                className={[
                  'group flex w-full items-center justify-between gap-2',
                  'rounded-[var(--r-sm)] px-2.5 py-2 text-left',
                  'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
                  active
                    ? 'bg-[var(--p)] text-[var(--ti)]'
                    : locked
                      ? 'cursor-not-allowed opacity-50'
                      : 'text-[var(--t2)] hover:bg-[var(--bg)] hover:text-[var(--t1)]',
                ].join(' ')}
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className={[
                      'font-mono text-[11px] tabular-nums',
                      active ? 'text-[var(--ti)]' : 'text-[var(--t3)]',
                    ].join(' ')}
                  >
                    {ch.chapter_idx.toString().padStart(2, '0')}
                  </span>
                  <span className="line-clamp-1 font-display text-[12px] font-[600]">
                    {ch.chapter_title ?? `Chapter ${ch.chapter_idx}`}
                  </span>
                </div>

                {locked ? (
                  <Lock size={11} className="shrink-0 text-[var(--t5)]" aria-label="잠김" />
                ) : (
                  <span
                    className={[
                      'shrink-0 font-mono text-[10px] tabular-nums',
                      active ? 'text-[var(--ti)] opacity-80' : 'text-[var(--t5)]',
                    ].join(' ')}
                  >
                    {Math.round(ch.word_count / 100) / 10}k
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
