// apps/web/src/components/library/reader/ChapterSidebar.tsx
// LCP v2.0 Phase 12.5 — Reader 사이드바 (chapter list)
// v06.x — group_label(Volume/Book·sub-book) 이 있으면 collapsible 그룹으로 렌더.
//   평면 chapter_idx 유지 — group_label NULL 인 책은 기존 평면 목록.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type { ChapterListItem } from '@/lib/library/reader-queries'
import type { ReaderMode } from './BookContentReader'

interface ChapterSidebarProps {
  chapters: ChapterListItem[]
  activeIdx: number
  mode: ReaderMode
  onSelect: (idx: number) => void
}

interface Segment {
  key: string
  label: string | null
  items: ChapterListItem[]
}

// group_label 이 같은 연속 챕터를 한 그룹으로 (책 안에서 같은 Book/sub-book 은 연속)
function buildSegments(chapters: ChapterListItem[]): Segment[] {
  const segs: Segment[] = []
  for (const ch of chapters) {
    const label = ch.group_label ?? null
    const last = segs[segs.length - 1]
    if (last && last.label === label) last.items.push(ch)
    else segs.push({ key: `${label ?? '_'}#${ch.chapter_idx}`, label, items: [ch] })
  }
  return segs
}

export function ChapterSidebar({ chapters, activeIdx, mode, onSelect }: ChapterSidebarProps) {
  const segments = useMemo(() => buildSegments(chapters), [chapters])
  const hasGroups = useMemo(() => segments.some((s) => s.label), [segments])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // 그룹 있는 책: 기본 전부 접되, 활성 챕터가 든 그룹만 펼침
  useEffect(() => {
    if (!segments.some((s) => s.label)) return
    const next = new Set<string>()
    for (const s of segments) {
      if (s.label && !s.items.some((c) => c.chapter_idx === activeIdx)) next.add(s.key)
    }
    setCollapsed(next)
    // activeIdx 는 의도적으로 deps 제외 — 챕터 목록 바뀔 때만 초기화 (아래 effect 가 활성 그룹 펼침 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments])

  // 활성 챕터의 그룹은 항상 펼침 (reader next/prev 로 이동해도)
  useEffect(() => {
    const seg = segments.find((s) => s.items.some((c) => c.chapter_idx === activeIdx))
    if (!seg?.label) return
    setCollapsed((prev) => {
      if (!prev.has(seg.key)) return prev
      const n = new Set(prev)
      n.delete(seg.key)
      return n
    })
  }, [activeIdx, segments])

  function toggle(key: string) {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  return (
    <nav
      className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-[var(--bd)] bg-[var(--bg2)]"
      aria-label="장 목록"
    >
      <div className="border-b border-[var(--bd)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">목차</span>
      </div>

      <ul role="list" className="flex flex-col gap-0.5 p-2">
        {segments.map((seg) => {
          const isCollapsed = collapsed.has(seg.key)
          return (
            <li key={seg.key}>
              {seg.label && (
                <button
                  type="button"
                  onClick={() => toggle(seg.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-1.5 text-left text-[var(--t2)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} className="shrink-0 text-[var(--t3)]" aria-hidden />
                  ) : (
                    <ChevronDown size={12} className="shrink-0 text-[var(--t3)]" aria-hidden />
                  )}
                  <span className="line-clamp-2 font-display text-[11px] font-[700] uppercase tracking-wide text-[var(--t3)]">
                    {seg.label}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--t5)]">
                    {seg.items.length}
                  </span>
                </button>
              )}

              {!(seg.label && isCollapsed) && (
                <ul role="list" className={seg.label ? 'flex flex-col gap-0.5 pl-2' : 'flex flex-col gap-0.5'}>
                  {seg.items.map((ch) => (
                    <ChapterRow
                      key={ch.chapter_idx}
                      ch={ch}
                      active={ch.chapter_idx === activeIdx}
                      locked={mode === 'user-preview' && ch.chapter_idx > 1}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ChapterRow({
  ch,
  active,
  locked,
  onSelect,
}: {
  ch: ChapterListItem
  active: boolean
  locked: boolean
  onSelect: (idx: number) => void
}) {
  return (
    <li>
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
}
