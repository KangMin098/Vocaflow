// apps/web/src/components/wordvault/WordRow.tsx
//
// 단어 행 v4 (v06.21.5) — 펼침 메커니즘 제거 + 예문 우측 정렬 + 학습 효율 강화
//
// 변경 (v06.21.5):
//   - 행 펼침/접힘 chevron 제거 — 모든 정보가 항상 한 행에 노출
//   - 예문 우측 정렬 (text-right) — 시선 흐름: 영단어 → 뜻 → 예문
//   - 예문 하단 메타("N일 전·N일 후 복습·마스터 N/5") 제거 — Calm UI (압박 ↓)
//
// 학습 효과 강화:
//   - 행 클릭 시 발음 자동 재생 (중복 클릭 비용 제거 — Fitts's law)
//   - Memory state 좌측 1~2px 엣지 색상 항상 노출 (4색 토큰 시각 인지)
//   - 영단어/뜻/예문 시각 위계 명확화 — 영단어(t1 600 16px) > 뜻(t1 500 13px) > 예문(t3 italic 12.5px)
//   - hover 시 행 미세 hover-lift bg2/60 + 좌측 엣지 풀 opacity
//   - 예문 우측 정렬 → 영어 본문 line-end가 시각 흐름 안정 (좌→우→완결)

'use client'

import { MemoryBadge } from '@/components/ui/MemoryBadge'
import { cn } from '@/lib/utils/cn'
import { Play } from 'lucide-react'
import { getMemoryState, type MemoryState } from '@/lib/srs'
import type { HideStates, WordItem } from './types'

const MEMORY_EDGE_COLOR: Record<MemoryState, string> = {
  stable: 'var(--memory-stable)',
  shaky: 'var(--memory-shaky)',
  risk: 'var(--memory-risk)',
  new: 'var(--memory-new)',
}

export interface WordRowProps {
  word: WordItem
  isSelected: boolean
  isPlaying: boolean
  hideStates: HideStates
  onToggleSelect: (id: number) => void
  onPlayWord: (id: number) => void
}

export function WordRow({
  word,
  isSelected,
  isPlaying,
  hideStates,
  onToggleSelect,
  onPlayWord,
}: WordRowProps) {
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation()

  const memoryState = word.srs ? getMemoryState(word.srs) : 'new'
  const edgeColor = MEMORY_EDGE_COLOR[memoryState]

  return (
    <div
      className={cn(
        'group relative transition-colors duration-fast',
        // 부드러운 gradient bottom border
        'after:pointer-events-none after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px',
        'after:bg-gradient-to-r after:from-transparent after:via-bd after:to-transparent',
        'last:after:hidden',
        isPlaying && 'bg-learn-fresh-light/50',
        isSelected && !isPlaying && 'bg-learn-mastered-light/30',
        !isPlaying && !isSelected && 'hover:bg-bg2/60'
      )}
      data-id={word.id}
    >
      {/* 좌측 Memory state 엣지 — 4색 시각 단서 */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 top-0 transition-all duration-normal',
          isPlaying ? 'w-[2px]' : 'w-px opacity-50 group-hover:opacity-100'
        )}
        style={{ backgroundColor: isPlaying ? 'var(--memory-stable)' : edgeColor }}
      />

      {/* ── 메인 행 (8 column grid) ── */}
      <div
        onClick={() => onPlayWord(word.id)}
        className={cn(
          'grid cursor-pointer items-center gap-3 px-4 py-2.5 md:gap-4'
        )}
        style={{
          gridTemplateColumns:
            'auto auto minmax(0, 200px) minmax(0, 130px) minmax(0, 1fr) auto auto',
        }}
      >
        {/* 1. 체크박스 */}
        <button
          type="button"
          onClick={(e) => {
            stopBubble(e)
            onToggleSelect(word.id)
          }}
          aria-label={isSelected ? '선택 해제' : '선택'}
          aria-pressed={isSelected}
          className={cn(
            'flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] transition-all duration-fast',
            isSelected
              ? 'bg-learn-mastered border-learn-mastered'
              : 'border-bd-strong hover:border-learn-mastered bg-bg'
          )}
        >
          {isSelected && (
            <span
              className="block h-[3.5px] w-[7px] -translate-y-[0.5px] rotate-[-45deg]"
              style={{
                borderLeft: '1.5px solid white',
                borderBottom: '1.5px solid white',
              }}
            />
          )}
        </button>

        {/* 2. 재생 버튼 (행 클릭과 동일 동작 — 시각 단서 보존) */}
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all duration-fast',
            isPlaying
              ? 'bg-learn-fresh text-white shadow-sm ring-2 ring-learn-fresh/20'
              : 'text-t3 group-hover:bg-learn-fresh-light group-hover:text-learn-fresh'
          )}
        >
          <Play size={10} fill="currentColor" />
        </span>

        {/* 3. 영단어 + Memory dot + POS */}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span
            onClick={stopBubble}
            className={cn(
              'truncate font-serif text-[16px] font-[600] leading-tight tracking-[-0.015em] text-t1',
              'transition-[filter] duration-normal',
              hideStates.word && 'cursor-pointer select-none blur-[8px] hover:blur-0'
            )}
          >
            {word.word}
          </span>
          <MemoryBadge srs={word.srs} size="xs" />
          <sup className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-t4">
            {word.pos.replace(/\.$/, '')}
          </sup>
        </div>

        {/* 4. 뜻 */}
        <div
          onClick={stopBubble}
          className={cn(
            'min-w-0 truncate font-body text-[13px] font-[500] leading-snug text-t1',
            'transition-[filter] duration-normal',
            hideStates.meaning && 'cursor-pointer select-none blur-[8px] hover:blur-0'
          )}
        >
          {word.meaning}
        </div>

        {/* 5. 예문 — 우측 정렬 (Lora italic + ❝❞) */}
        <div
          className="hidden min-w-0 md:block"
          onClick={stopBubble}
        >
          {word.exampleEn ? (
            <p
              className={cn(
                'truncate text-right font-serif text-[12.5px] font-[500] italic leading-[1.55] tracking-[0.005em] text-t3',
                'before:mr-[1px] before:font-[700] before:text-t4 before:content-["\\201C"]',
                'after:ml-[1px] after:font-[700] after:text-t4 after:content-["\\201D"]'
              )}
            >
              {word.exampleEn}
            </p>
          ) : (
            <span className="block text-right font-body text-[12px] text-t4">
              —
            </span>
          )}
        </div>

        {/* 6. 마스터 5점 dot */}
        <div
          className="flex shrink-0 items-center gap-[3px]"
          title={`마스터 ${word.mastery}/5`}
          aria-label={`마스터 ${word.mastery} of 5`}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] w-[5px] rounded-full transition-all duration-normal',
                i > word.mastery && 'bg-bg3',
                i <= word.mastery && word.mastery === 1 && 'bg-t4',
                i <= word.mastery && word.mastery === 2 && 'bg-learn-fresh',
                i <= word.mastery && word.mastery === 3 && 'bg-learn-progress',
                i <= word.mastery && word.mastery === 4 && 'bg-learn-known',
                i <= word.mastery && word.mastery === 5 && 'bg-learn-mastered'
              )}
            />
          ))}
        </div>

        {/* 7. 레벨 칩 */}
        <span
          className={cn(
            'shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[10px] font-[700] tracking-wide',
            `bg-level-${word.levelClass}-light text-level-${word.levelClass}`
          )}
        >
          {word.level}
        </span>
      </div>
    </div>
  )
}
