// apps/web/src/components/wordvault/WordList.tsx
// 단어 리스트 컨테이너 v2 (v06.21.5) — 펼침 메커니즘 제거
//
// 변경: expandedIds · onToggleExpand props 제거 — WordRow 가 펼침 미지원

'use client'

import { cn } from '@/lib/utils/cn'
import { WordRow } from './WordRow'
import type { HideStates, WordItem } from './types'

export interface WordListProps {
  words: WordItem[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  playingId: number | null
  hideStates: HideStates
  onPlayWord: (id: number) => void
}

export function WordList({
  words,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  playingId,
  hideStates,
  onPlayWord,
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
            // ⚠️ 실측 18x18 (기준 44px). 보이는 상자는 그대로 두고 **누르는 자리만** 키운다 —
            //    음수 마진으로 차지하는 자리도 그대로다(WordRow 와 같은 처치).
            className={cn(
              'h-11 w-11 -m-[13px] shrink-0',
              'flex cursor-pointer items-center justify-center',
            )}
          >
            <span
              aria-hidden
              className={cn(
              'h-[18px] w-[18px] rounded-[5px] border-[1.5px]',
              'flex items-center justify-center',
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
            </span>
          </button>
          <span>전체 선택</span>
        </div>
        <div className="font-mono text-xs font-semibold text-t3">
          <span className="font-extrabold text-[var(--learn-mastered-ink)]">{selectedCount}</span>
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
            isPlaying={playingId === w.id}
            hideStates={hideStates}
            onToggleSelect={onToggleSelect}
            onPlayWord={onPlayWord}
          />
        ))}
      </div>
    </>
  )
}
