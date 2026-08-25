// apps/web/src/components/library/reader/ChapterSidebar.tsx
// LCP v2.0 Phase 12.5 — Reader 사이드바 (chapter list)
// v06.x — group_label(Volume/Book·sub-book) 이 있으면 collapsible 그룹으로 렌더.
//   평면 chapter_idx 유지 — group_label NULL 인 책은 기존 평면 목록.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Lock } from 'lucide-react'
import type { ChapterListItem } from '@/lib/library/reader-queries'
import { chapterSourceUrl } from '@/lib/library/source-urls'
import type { ReaderMode } from './BookContentReader'

interface ChapterSidebarProps {
  chapters: ChapterListItem[]
  activeIdx: number
  mode: ReaderMode
  onSelect: (idx: number) => void
  /** v06.34 — admin-review 모드에서 챕터 옆에 원본 소스 외부링크 표시 */
  source?: string | null
  sourceId?: string | null
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

export function ChapterSidebar({
  chapters,
  activeIdx,
  mode,
  onSelect,
  source,
  sourceId,
}: ChapterSidebarProps) {
  const showSourceLink = mode === 'admin-review' && !!source && !!sourceId
  const segments = useMemo(() => buildSegments(chapters), [chapters])
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
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">목차</span>
      </div>

      <ul role="list" className="flex flex-col gap-1 p-2">
        {segments.map((seg) => {
          const isCollapsed = collapsed.has(seg.key)
          return (
            <li key={seg.key}>
              {seg.label && (
                <button
                  type="button"
                  onClick={() => toggle(seg.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-1 rounded-[var(--r-sm)] px-2 py-2 text-left text-[var(--t2)] transition-colors hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} className="shrink-0 text-[var(--t2)]" aria-hidden />
                  ) : (
                    <ChevronDown size={12} className="shrink-0 text-[var(--t2)]" aria-hidden />
                  )}
                  <span className="line-clamp-2 font-display text-[11px] font-[700] uppercase tracking-wide text-[var(--t2)]">
                    {seg.label}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--t5)]">
                    {seg.items.length}
                  </span>
                </button>
              )}

              {!(seg.label && isCollapsed) && (
                <ul role="list" className={seg.label ? 'flex flex-col gap-1 pl-2' : 'flex flex-col gap-1'}>
                  {seg.items.map((ch) => (
                    <ChapterRow
                      key={ch.chapter_idx}
                      ch={ch}
                      active={ch.chapter_idx === activeIdx}
                      locked={mode === 'user-preview' && ch.chapter_idx > 1}
                      onSelect={onSelect}
                      sourceUrl={
                        showSourceLink
                          ? // 적재 시 매핑된 정확한 챕터 deep-link 우선, 없으면 소스별 best-effort/TOC fallback
                            (ch.source_href ??
                              chapterSourceUrl(source!, sourceId!, ch.chapter_idx, ch.chapter_title))
                          : null
                      }
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
  sourceUrl,
}: {
  ch: ChapterListItem
  active: boolean
  locked: boolean
  onSelect: (idx: number) => void
  /** v06.34 — admin 모드에서 챕터별 원본 소스 URL */
  sourceUrl?: string | null
}) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => !locked && onSelect(ch.chapter_idx)}
        disabled={locked}
        aria-current={active ? 'page' : undefined}
        className={[
          'group flex w-full items-center justify-between gap-2',
          'rounded-[var(--r-sm)] px-3 py-2 text-left',
          sourceUrl ? 'pr-9' : '',
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
              active ? 'text-[var(--ti)]' : 'text-[var(--t2)]',
            ].join(' ')}
          >
            {ch.chapter_idx.toString().padStart(2, '0')}
          </span>
          <span className="line-clamp-1 font-display text-[12px] font-[600]">
            {ch.chapter_title ?? `Chapter ${ch.chapter_idx}`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* 챕터별 어휘 V-level — 단일 book_v_level 이 뭉개는 챕터 편차 노출 (색상만 의존 X, 숫자 텍스트) */}
          {ch.chapter_v_level != null && (
            <span
              className={[
                'inline-flex items-center rounded-[var(--r-full)] border px-2 py-1',
                'font-mono text-[9px] font-[700] leading-none tabular-nums',
                active
                  ? 'border-[var(--ti)] text-[var(--ti)] opacity-80'
                  : 'border-[var(--bd)] text-[var(--t2)]',
              ].join(' ')}
              title={`이 장의 어휘 난이도 V${ch.chapter_v_level} — 책 전체 라벨과 다를 수 있어요`}
            >
              V{ch.chapter_v_level}
            </span>
          )}
          {locked ? (
            <Lock size={11} className="text-[var(--t5)]" aria-label="잠김" />
          ) : (
            <span
              className={[
                'font-mono text-[10px] tabular-nums',
                active ? 'text-[var(--ti)] opacity-80' : 'text-[var(--t5)]',
              ].join(' ')}
            >
              {Math.round(ch.word_count / 100) / 10}k
            </span>
          )}
        </div>
      </button>

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Chapter ${ch.chapter_idx} 원본 소스 열기`}
          aria-label={`Chapter ${ch.chapter_idx} 원본 소스 열기`}
          className={[
            'absolute right-1 top-1/2 -translate-y-1/2',
            'inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]',
            'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            active
              ? 'text-[var(--ti)] opacity-70 hover:opacity-100'
              : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--p)]',
          ].join(' ')}
        >
          <ExternalLink size={11} aria-hidden />
        </a>
      )}
    </li>
  )
}
