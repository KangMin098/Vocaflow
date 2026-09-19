// apps/web/src/components/workspace/ChapterBottomNav.tsx
// Phase 11.15.2 — chapter 번호 nav (이전 / 1 2 3 ... N / 다음)
//
// chapter context 시 본문 끝에 표시.
// 7개 이하: 모든 번호 표시. 8개 이상: 1 ... (N-1) N (N+1) ... last 형식.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ChapterNavItem } from '@/app/(main)/text/[id]/text-content-context'

interface ChapterBottomNavProps {
  chapters: ChapterNavItem[]
  currentChapterIdx: number
}

export function ChapterBottomNav({ chapters, currentChapterIdx }: ChapterBottomNavProps) {
  const router = useRouter()
  const sorted = [...chapters].sort((a, b) => a.chapterIdx - b.chapterIdx)
  const total = sorted.length
  const currentPos = sorted.findIndex((c) => c.chapterIdx === currentChapterIdx)
  const prev = currentPos > 0 ? sorted[currentPos - 1] : null
  const next = currentPos >= 0 && currentPos < total - 1 ? sorted[currentPos + 1] : null

  // 표시할 chapter list 생성 (1 2 3 ... last 형식)
  const items: Array<ChapterNavItem | 'gap'> = []
  if (total <= 7) {
    items.push(...sorted)
  } else {
    if (currentPos <= 3) {
      items.push(sorted[0]!, sorted[1]!, sorted[2]!, sorted[3]!, sorted[4]!, 'gap', sorted[total - 1]!)
    } else if (currentPos >= total - 4) {
      items.push(
        sorted[0]!,
        'gap',
        sorted[total - 5]!,
        sorted[total - 4]!,
        sorted[total - 3]!,
        sorted[total - 2]!,
        sorted[total - 1]!,
      )
    } else {
      items.push(
        sorted[0]!,
        'gap',
        sorted[currentPos - 1]!,
        sorted[currentPos]!,
        sorted[currentPos + 1]!,
        'gap',
        sorted[total - 1]!,
      )
    }
  }

  function go(item: ChapterNavItem) {
    router.push(`/text/${item.textId}?mode=read`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="장 이동"
      className="mx-auto mt-12 mb-12 flex max-w-[760px] items-center justify-between gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-6 py-5"
    >
      {/* 이전 */}
      <Link
        href={prev ? `/text/${prev.textId}?mode=read` : '#'}
        aria-disabled={!prev}
        onClick={(e) => {
          if (!prev) {
            e.preventDefault()
            return
          }
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        className={`inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ${
          prev
            ? 'hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)] hover:shadow-[var(--sh-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'
            : 'cursor-not-allowed opacity-40'
        }`}
      >
        <ChevronLeft size={14} strokeWidth={2} aria-hidden />
        <span>이전</span>
      </Link>

      {/* Chapter numbers */}
      <div className="flex items-center gap-1">
        {items.map((it, idx) => {
          if (it === 'gap') {
            return (
              <span key={`gap-${idx}`} className="px-1 font-display font-[700] text-[var(--t2)]" aria-hidden>
                ⋯
              </span>
            )
          }
          const isCurrent = it.chapterIdx === currentChapterIdx
          return (
            <button
              key={it.chapterIdx}
              type="button"
              onClick={() => go(it)}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={it.chapterTitle ? `Chapter ${it.chapterIdx} — ${it.chapterTitle}` : `Chapter ${it.chapterIdx}`}
              title={it.chapterTitle ?? `Chapter ${it.chapterIdx}`}
              className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-[var(--r-md)] px-2 font-display text-[13px] font-[600] tabular-nums transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                isCurrent
                  ? 'bg-[var(--p)] text-white shadow-[var(--sh-sm)] hover:bg-[var(--p-hover)]'
                  : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
              }`}
            >
              {it.chapterIdx}
            </button>
          )
        })}
      </div>

      {/* 다음 */}
      <Link
        href={next ? `/text/${next.textId}?mode=read` : '#'}
        aria-disabled={!next}
        onClick={(e) => {
          if (!next) {
            e.preventDefault()
            return
          }
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        className={`inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ${
          next
            ? 'hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)] hover:shadow-[var(--sh-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'
            : 'cursor-not-allowed opacity-40'
        }`}
      >
        <span>다음</span>
        <ChevronRight size={14} strokeWidth={2} aria-hidden />
      </Link>
    </nav>
  )
}
