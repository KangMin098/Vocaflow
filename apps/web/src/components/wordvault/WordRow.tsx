// apps/web/src/components/wordvault/WordRow.tsx
// 단일 단어 행 — 좌우 분할 + 펼침/접힘 + 숨김 적용

'use client'

import { cn } from '@/lib/utils/cn'
import { Calendar, ChevronDown, Play, Repeat, Target, Volume2 } from 'lucide-react'
import type { HideStates, WordItem } from './types'

export interface WordRowProps {
  /** 단어 데이터 */
  word: WordItem
  /** 선택 여부 */
  isSelected: boolean
  /** 펼침 여부 */
  isExpanded: boolean
  /** 재생 중 여부 */
  isPlaying: boolean
  /** 숨김 상태 (영단어/뜻/예문) */
  hideStates: HideStates
  /** 펼침 토글 */
  onToggleExpand: (id: number) => void
  /** 선택 토글 */
  onToggleSelect: (id: number) => void
  /** 단어 재생 */
  onPlayWord: (id: number) => void
  /** 예문 재생 */
  onPlayExample: (id: number) => void
}

export function WordRow({
  word,
  isSelected,
  isExpanded,
  isPlaying,
  hideStates,
  onToggleExpand,
  onToggleSelect,
  onPlayWord,
  onPlayExample,
}: WordRowProps) {
  const stopBubble = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      className={cn(
        'relative border-b border-bd transition-colors duration-fast last:border-b-0',
        isPlaying && 'bg-learn-fresh-light',
        isSelected && !isPlaying && 'bg-learn-mastered-light'
      )}
      data-id={word.id}
    >
      {isPlaying && (
        <span
          aria-hidden
          className="bg-learn-fresh absolute bottom-0 left-0 top-0 w-[3px] rounded-r"
        />
      )}

      {/* 메인 행 */}
      <div
        onClick={() => onToggleExpand(word.id)}
        className={cn(
          'grid cursor-pointer items-center gap-s-4 px-s-5 py-s-4',
          'transition-colors duration-fast',
          'hover:bg-bg2',
          isSelected && 'hover:brightness-[0.98]'
        )}
        style={{
          gridTemplateColumns: 'auto auto 1fr auto auto',
        }}
      >
        {/* 체크박스 */}
        <button
          type="button"
          onClick={(e) => {
            stopBubble(e)
            onToggleSelect(word.id)
          }}
          aria-label={isSelected ? '선택 해제' : '선택'}
          aria-pressed={isSelected}
          className={cn(
            'h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px]',
            'flex items-center justify-center',
            'transition-all duration-fast',
            isSelected
              ? 'bg-learn-mastered border-learn-mastered'
              : 'border-bd-strong hover:border-learn-mastered bg-bg'
          )}
        >
          {isSelected && (
            <span
              className="block h-[5px] w-[9px] -translate-y-px rotate-[-45deg]"
              style={{
                borderLeft: '1.5px solid white',
                borderBottom: '1.5px solid white',
              }}
            />
          )}
        </button>

        {/* 재생 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            stopBubble(e)
            onPlayWord(word.id)
          }}
          aria-label="발음 재생"
          className={cn(
            'h-9 w-9 shrink-0 rounded-md border',
            'flex items-center justify-center',
            'transition-all duration-fast',
            isPlaying
              ? 'bg-learn-fresh border-learn-fresh text-white'
              : 'group-hover:bg-learn-fresh border-bd bg-bg text-t2 group-hover:text-white'
          )}
        >
          <Play size={11} fill="currentColor" />
        </button>

        {/* 좌우 분할 컨텐츠 */}
        <div className="grid min-w-0 grid-cols-1 items-center gap-s-2 md:grid-cols-[320px_1fr] md:gap-s-6">
          {/* 좌측 — 영단어 (★ L1) */}
          <div className="flex min-w-0 flex-col gap-s-1">
            <div
              onClick={stopBubble}
              className={cn(
                'font-serif text-[30px] font-bold text-t1',
                'leading-[1.15] tracking-[-0.02em]',
                'transition-[filter] duration-normal',
                'inline-flex items-baseline',
                hideStates.word && 'cursor-pointer select-none blur-[10px] hover:blur-0'
              )}
            >
              {word.word}
            </div>
            <div className="flex items-center gap-s-2">
              <span className="font-mono text-[11px] font-semibold lowercase text-t3">
                {word.pos}
              </span>
              <span className="flex items-center gap-[5px] font-display text-[11px] font-medium text-t4">
                <Calendar size={10} className="opacity-70" />
                {word.lastDays}일 전 학습
              </span>
            </div>
          </div>

          {/* 우측 — 뜻 (★ L2) */}
          <div
            onClick={stopBubble}
            className={cn(
              'font-body text-[17px] font-semibold leading-[1.45] text-t1',
              'tracking-[-0.01em]',
              'transition-[filter] duration-normal',
              hideStates.meaning && 'cursor-pointer select-none blur-[10px] hover:blur-0'
            )}
          >
            {word.meaning}
          </div>
        </div>

        {/* 우측 메타 */}
        <div className="flex shrink-0 items-center gap-s-3">
          {/* 마스터 5단계 게이지 */}
          <div className="flex items-center gap-[3px]" title={`마스터 ${word.mastery}/5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-[18px] w-[6px] rounded-[2px] transition-all duration-normal',
                  i > word.mastery && 'bg-bg2',
                  i <= word.mastery && word.mastery === 1 && 'bg-t5',
                  i <= word.mastery && word.mastery === 2 && 'bg-learn-fresh',
                  i <= word.mastery && word.mastery === 3 && 'bg-learn-progress',
                  i <= word.mastery && word.mastery === 4 && 'bg-learn-known',
                  i <= word.mastery && word.mastery === 5 && 'bg-learn-mastered'
                )}
              />
            ))}
          </div>

          {/* 난이도 칩 */}
          <span
            className={cn(
              'rounded-sm px-s-2 py-[3px] font-mono text-[11px] font-bold tracking-[0.02em]',
              `bg-level-${word.levelClass}-light text-level-${word.levelClass}`
            )}
          >
            {word.level}
          </span>

          {/* 펼침 화살표 */}
          <button
            type="button"
            onClick={(e) => {
              stopBubble(e)
              onToggleExpand(word.id)
            }}
            aria-label={isExpanded ? '접기' : '펼치기'}
            aria-expanded={isExpanded}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-sm',
              'text-t3 hover:bg-bg2 hover:text-t1',
              'transition-all duration-fast',
              isExpanded && 'text-learn-fresh rotate-180'
            )}
          >
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* 확장 영역 */}
      {isExpanded && (
        <div className="animate-[expandDown_250ms_cubic-bezier(0,0,.2,1)] px-s-5 pb-s-4 pl-[92px]">
          {/* ★ 예문 — 숨김 적용 */}
          <div className="border-learn-fresh flex items-start gap-s-3 rounded-lg border-l-[3px] bg-bg2 px-s-4 py-s-3">
            <div
              className={cn(
                'flex-1 font-serif text-sm font-medium italic text-t2',
                'leading-[1.65] tracking-[0.005em]',
                'before:text-learn-fresh before:mr-[2px] before:text-[18px] before:content-["\\201C"]',
                'after:text-learn-fresh after:ml-[2px] after:text-[18px] after:content-["\\201D"]'
              )}
              onClick={stopBubble}
            >
              {word.exampleEn}
            </div>
            <button
              type="button"
              onClick={(e) => {
                stopBubble(e)
                onPlayExample(word.id)
              }}
              aria-label="예문 듣기"
              className="hover:bg-learn-fresh hover:border-learn-fresh flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm border border-bd bg-bg text-t2 transition-all duration-fast hover:text-white"
            >
              <Volume2 size={12} />
            </button>
          </div>

          {/* SRS 메타 */}
          <div className="mt-s-3 flex items-center gap-s-4 px-s-1 font-display text-[11px] font-medium text-t3">
            <span className="flex items-center gap-[5px]">
              <Calendar size={10} className="opacity-70" />
              마지막: {word.lastDays}일 전
            </span>
            <span className="text-t5">·</span>
            <span className="flex items-center gap-[5px]">
              <Repeat size={10} className="opacity-70" />
              다음 복습: {word.nextDays}일 후
            </span>
            <span className="text-t5">·</span>
            <span className="flex items-center gap-[5px]">
              <Target size={10} className="opacity-70" />
              마스터 {word.mastery}/5단계
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
