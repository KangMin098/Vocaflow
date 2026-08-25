// apps/web/src/components/wordvault/WordList.tsx
// 단어 리스트 컨테이너 v2 (v06.21.5) — 펼침 메커니즘 제거
//
// 변경: expandedIds · onToggleExpand props 제거 — WordRow 가 펼침 미지원

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
  /**
   * **한 번에 다 그리지 않는다.**
   *
   * ⚠️ 실측 2026-08-25: 이 화면의 DOM 이 **6,016 노드** 였다(Lighthouse dom-size 는
   *    1,500 을 경고 · 3,000 을 실패로 본다). 단어 하나가 12 노드쯤 되므로 어휘가
   *    늘수록 선형으로 커진다 — 즉 **잘 쓰는 학습자일수록 느려지는** 구조다.
   *
   * 데이터는 그대로 전부 들고 있다(선택·검색·단축키는 모두 words 배열 위에서 돈다).
   * 그리는 것만 미룬다 — 바닥에 닿으면 다음 묶음을 붙인다.
   * ⚠️ 대신 브라우저 Ctrl+F 는 아직 안 그린 행을 못 찾는다. 이 화면은 자체 검색을
   *    갖고 있으므로 그쪽이 정본이다.
   */
  const CHUNK = 80
  const [visibleCount, setVisibleCount] = useState(CHUNK)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 필터가 바뀌면 처음부터 — 안 그러면 좁은 결과에서도 이전 창 크기를 들고 있는다.
  useEffect(() => { setVisibleCount(CHUNK) }, [words])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visibleCount >= words.length) return
    // IntersectionObserver 가 없는 환경(구형·테스트 러너)에서는 전부 그린다 —
    // 조용히 잘려 보이는 것이 가장 나쁘다.
    if (typeof IntersectionObserver === 'undefined') { setVisibleCount(words.length); return }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisibleCount((n) => Math.min(n + CHUNK, words.length)) },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visibleCount, words.length])

  const visibleWords = useMemo(() => words.slice(0, visibleCount), [words, visibleCount])

  const selectedCount = selectedIds.size
  const totalCount = words.length
  const isAll = selectedCount === totalCount && totalCount > 0
  const isPartial = selectedCount > 0 && selectedCount < totalCount

  return (
    <>
      {/* 전체 선택 바 */}
      <div className="py-s-3 flex items-center justify-between rounded-t-xl border border-b-0 border-bd bg-bg px-s-4 font-display text-[13px] font-semibold text-t2">
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
        {visibleWords.map((w) => (
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
        {visibleCount < words.length && (
          <div
            ref={sentinelRef}
            className="px-s-4 py-s-3 text-center font-mono text-xs text-t3"
            aria-live="polite"
          >
            {visibleCount.toLocaleString()} / {words.length.toLocaleString()}개 표시 중 — 스크롤하면 더 불러와요
          </div>
        )}
      </div>
    </>
  )
}
