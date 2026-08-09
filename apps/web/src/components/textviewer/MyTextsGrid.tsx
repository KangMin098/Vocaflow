// apps/web/src/components/textviewer/MyTextsGrid.tsx
//
// 사용자 자기 입력 스크립트 그리드 — CEFR 필터 + 검색 + 정렬
// CLAUDE.md §17.1 L1 Acquire — 누적 자산 시각화

'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TextCard } from './TextCard'

import type { CEFRLevel, LibraryText } from '@/types/library'

interface MyTextsGridProps {
  texts: LibraryText[]
}

const CEFR_LEVELS: (CEFRLevel | 'all')[] = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function MyTextsGrid({ texts }: MyTextsGridProps) {
  const [filter, setFilter] = useState<CEFRLevel | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let result = texts
    if (filter !== 'all') {
      result = result.filter((t) => t.cefrLevel === filter)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q),
      )
    }
    // Sort: in-progress first, then by lastStudiedAt DESC, then by addedAt DESC
    return [...result].sort((a, b) => {
      const aActive = a.progressPercent > 0 && a.progressPercent < 100 ? 1 : 0
      const bActive = b.progressPercent > 0 && b.progressPercent < 100 ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      const aTime = a.lastStudiedAt?.getTime() ?? a.addedAt.getTime()
      const bTime = b.lastStudiedAt?.getTime() ?? b.addedAt.getTime()
      return bTime - aTime
    })
  }, [texts, filter, query])

  return (
    <section
      aria-label="내 스크립트 목록"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      {/* Header */}
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
            내 스크립트
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">총 {texts.length}개</p>
        </div>

        {/* Search */}
        <div className="relative flex-1 md:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 또는 저자 검색"
            aria-label="스크립트 검색"
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t2)] focus:border-[var(--p)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          />
        </div>
      </header>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="레벨 필터">
        {CEFR_LEVELS.map((level) => {
          const active = filter === level
          const count =
            level === 'all'
              ? texts.length
              : texts.filter((t) => t.cefrLevel === level).length
          if (level !== 'all' && count === 0) return null

          return (
            <button
              key={level}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(level)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-display text-[11px] font-[700] uppercase tracking-wider transition-colors duration-[var(--dur-normal)] ${
                active
                  ? 'bg-[var(--p)] text-white shadow-[var(--sh-xs)]'
                  : 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
              }`}
            >
              <span>{level === 'all' ? '전체' : level}</span>
              <span className="font-mono opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((text) => (
            <li key={text.id}>
              <TextCard text={text} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-8 text-center">
          <p className="font-body text-[13px] text-[var(--t2)]">
            {query.trim()
              ? `"${query}" 검색 결과가 없어요`
              : '이 레벨의 스크립트이 아직 없어요'}
          </p>
        </div>
      )}
    </section>
  )
}
