// apps/web/src/components/wordvault/WordList.tsx
// 단어 리스트 컨테이너 — 전체 선택 바 + 단어 행들

'use client'

import { cn } from '@/lib/utils/cn'
import { WordRow } from './WordRow'
import type { HideStates, WordItem } from './types'

export interface WordListProps {
  /** 단어 목록 */
  words: WordItem[]
  /** 선택된 단어 ID */
  selectedIds: Set<number>
  /** 선택 토글 */
  onToggleSelect: (id: number) => void
  /** 전체 선택 토글 */
  onToggleSelectAll: () => void
  /** 펼쳐진 단어 ID (controlled) */
  expandedIds: Set<number>
  /** 펼침 토글 (controlled) */
  onToggleExpand: (id: number) => void
  /** 재생 중인 단어 ID */
  playingId: number | null
  /** 숨김 상태 */
  hideStates: HideStates
  /** 단어 재생 */
  onPlayWord: (id: number) => void
  /** 예문 재생 */
  onPlayExample: (id: number) => void
}

export function WordList({
  words,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  expandedIds,
  onToggleExpand,
  playingId,
  hideStates,
  onPlayWord,
  onPlayExample,
}: WordListProps) {
  const selectedCount = selectedIds.size
  const totalCount = words.length
  const isAll = selectedCount === totalCount && totalCount > 0
  const isPartial = selectedCount > 0 && selectedCount < totalCount

  return (
    <>
      {/* 전체 선택 바 */}
      <div className="py-s-2.5 flex items-center justify-between rounded-t-xl border border-b-0 border-bd bg-bg px-s-4 font-display text-[13px] font-semibold text-t2">
        <div className="flex items-center gap-s-3">
          <button
            type="button"
            onClick={onToggleSelectAll}
            aria-label="전체 선택 토글"
            aria-checked={isAll}
            role="checkbox"
            className={cn(
              'h-[18px] w-[18px] rounded-[5px] border-[1.5px]',
              'flex cursor-pointer items-center justify-center',
              'transition-all duration-fast',
              isAll && 'border-p bg-p',
              isPartial && !isAll && 'border-p bg-bg2',
              !isAll && !isPartial && 'border-bd-strong bg-bg'
            )}
          >
            {isAll && (
              <span
                className="block h-[5px] w-[9px] -translate-y-px rotate-[-45deg]"
                style={{
                  borderLeft: '1.5px solid var(--bg)',
                  borderBottom: '1.5px solid var(--bg)',
                }}
              />
            )}
            {isPartial && !isAll && <span className="block h-[1.5px] w-[8px] rounded-[1px] bg-p" />}
          </button>
          <span>전체 선택</span>
        </div>
        <div className="font-mono text-xs font-semibold text-t3">
          <span className="text-learn-mastered font-extrabold">{selectedCount}</span>
          {' / '}
          {totalCount}개 선택됨
        </div>
      </div>

      {/* 단어 행 리스트 */}
      <div className="overflow-hidden rounded-b-xl border border-bd bg-bg">
        {words.map((w) => (
          <WordRow
            key={w.id}
            word={w}
            isSelected={selectedIds.has(w.id)}
            isExpanded={expandedIds.has(w.id)}
            isPlaying={playingId === w.id}
            hideStates={hideStates}
            onToggleExpand={onToggleExpand}
            onToggleSelect={onToggleSelect}
            onPlayWord={onPlayWord}
            onPlayExample={onPlayExample}
          />
        ))}
      </div>
    </>
  )
}
