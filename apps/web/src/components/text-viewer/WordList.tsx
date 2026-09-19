// apps/web/src/components/text-viewer/WordList.tsx
// 추출된 단어 리스트 + 검색/필터/정렬

'use client'

import { cn } from '@/lib/utils/cn'
import { ListChecks, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CefrLevel, ExtractedWord } from './analysis-types'
import { WordCard } from './WordCard'

// ══════════════════════════════════════════════════════════════
// Sort & Filter
// ══════════════════════════════════════════════════════════════
type SortKey = 'appearance' | 'level' | 'alphabetical'
type LevelFilter = 'all' | CefrLevel

const sortLabels: Record<SortKey, string> = {
  appearance: '스크립트 순서',
  level: '난이도 순',
  alphabetical: '알파벳 순',
}

const levelOrder: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
}

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════
export interface WordListProps {
  words: ExtractedWord[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onHover?: (id: string | null) => void
  onPlayAudio?: (word: string) => void
}

export function WordList({
  words,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onHover,
  onPlayAudio,
}: WordListProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('appearance')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')

  // 필터 + 정렬
  const filteredWords = useMemo(() => {
    let result = [...words]

    // 검색 필터
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.includes(q))
    }

    // 난이도 필터
    if (levelFilter !== 'all') {
      result = result.filter((w) => w.level === levelFilter)
    }

    // 정렬
    if (sortKey === 'level') {
      result.sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
    } else if (sortKey === 'alphabetical') {
      result.sort((a, b) => a.word.localeCompare(b.word))
    }
    // appearance는 원본 순서 유지

    return result
  }, [words, search, sortKey, levelFilter])

  // 선택 통계
  const selectedCount = selectedIds.size
  const totalCount = words.length
  const allSelected = selectedCount === totalCount
  const noneSelected = selectedCount === 0

  // 난이도별 카운트
  const levelCounts = useMemo(() => {
    const counts: Record<CefrLevel | 'all', number> = {
      all: words.length,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    }
    words.forEach((w) => counts[w.level]++)
    return counts
  }, [words])

  const levels: LevelFilter[] = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-bd bg-bg">
      {/* 헤더 */}
      <div className="border-b border-bd bg-bg2 px-s-5 py-s-3">
        <div className="mb-s-1 flex items-center gap-s-2">
          <ListChecks size={12} className="text-p" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
            — Step 03 / 추출된 단어 {words.length}개
          </span>
        </div>
        <h3 className="font-display text-base font-bold text-t1">학습할 단어 선택</h3>
      </div>

      {/* 검색 + 정렬 */}
      <div className="space-y-s-2 border-b border-bd bg-bg px-s-4 py-s-3">
        {/* 검색 */}
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-s-3 top-1/2 -translate-y-1/2 text-t3"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="단어 또는 의미로 검색..."
            className="pl-s-9 focus:ring-p/20 h-9 w-full rounded-md border border-bd bg-bg2 pr-s-3 font-body text-sm text-t1 transition-all duration-normal placeholder:text-t3 focus:border-bdf focus:outline-none focus:ring-2"
          />
        </div>

        {/* 정렬 + 난이도 필터 */}
        <div className="flex items-center gap-s-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-8 cursor-pointer rounded-md border border-bd bg-bg2 px-s-2 font-mono text-[10px] uppercase tracking-wider text-t1 transition-all duration-normal focus:border-bdf focus:outline-none"
          >
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {sortLabels[k]}
              </option>
            ))}
          </select>

          {/* 난이도 chip 필터 */}
          <div className="flex items-center gap-s-1 overflow-x-auto">
            {levels.map((lvl) => {
              const isActive = levelFilter === lvl
              const count = levelCounts[lvl]
              if (count === 0 && lvl !== 'all') return null
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={cn(
                    'shrink-0 rounded px-s-2 py-[4px] font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-normal',
                    isActive ? 'bg-p text-ti' : 'bg-bg2 text-t2 hover:bg-bg3 hover:text-t1'
                  )}
                >
                  {lvl === 'all' ? '전체' : lvl}{' '}
                  <span className="ml-[2px] tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 전체 선택 바 */}
      <div className="flex items-center justify-between border-b border-bd bg-bg px-s-4 py-s-2">
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="font-mono text-[10px] font-semibold uppercase tracking-wider text-p transition-colors duration-normal hover:text-p-hover"
        >
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-t3">
          <span className={cn('font-bold tabular-nums', noneSelected ? 'text-t3' : 'text-p')}>
            {selectedCount}
          </span>
          <span className="text-t3"> / </span>
          <span className="tabular-nums">{totalCount}</span> 개 선택됨
        </span>
      </div>

      {/* 단어 리스트 */}
      <div className="flex-1 space-y-s-2 overflow-y-auto p-s-3">
        {filteredWords.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-s-8 text-center">
            <div className="mb-s-2 font-mono text-[10px] uppercase tracking-wider text-t3">
              검색 결과 없음
            </div>
            <p className="font-body text-sm text-t2">다른 검색어를 시도해보세요</p>
          </div>
        ) : (
          filteredWords.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              selected={selectedIds.has(word.id)}
              onToggle={onToggle}
              onHover={onHover}
              onPlayAudio={onPlayAudio}
            />
          ))
        )}
      </div>
    </div>
  )
}
