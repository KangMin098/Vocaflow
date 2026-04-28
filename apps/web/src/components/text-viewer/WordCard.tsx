// apps/web/src/components/text-viewer/WordCard.tsx
// 추출된 단어 — 개별 카드
// 체크박스 + 단어 + 의미 + 난이도 chip

'use client'

import { cn } from '@/lib/utils/cn'
import { Check, Volume2 } from 'lucide-react'
import type { CefrLevel, ExtractedWord } from './analysis-types'

// CEFR 난이도별 색상
const levelColors: Record<CefrLevel, { bg: string; text: string; border: string }> = {
  A1: { bg: 'bg-success-light', text: 'text-success', border: 'border-success/30' },
  A2: { bg: 'bg-success-light', text: 'text-success', border: 'border-success/30' },
  B1: { bg: 'bg-info-light', text: 'text-info', border: 'border-info/30' },
  B2: { bg: 'bg-warning-light', text: 'text-warning', border: 'border-warning/30' },
  C1: { bg: 'bg-error-light', text: 'text-error', border: 'border-error/30' },
  C2: { bg: 'bg-error-light', text: 'text-error', border: 'border-error/30' },
}

export interface WordCardProps {
  word: ExtractedWord
  selected: boolean
  onToggle: (id: string) => void
  onHover?: (id: string | null) => void
  onPlayAudio?: (word: string) => void
}

export function WordCard({ word, selected, onToggle, onHover, onPlayAudio }: WordCardProps) {
  const levelStyle = levelColors[word.level]

  return (
    <div
      onClick={() => onToggle(word.id)}
      onMouseEnter={() => onHover?.(word.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        'group flex cursor-pointer items-center gap-s-3 rounded-lg p-s-3',
        'border transition-all duration-normal',
        selected ? 'border-p bg-p-light' : 'border-bd bg-bg hover:border-t2 hover:bg-bg2'
      )}
    >
      {/* 커스텀 체크박스 */}
      <div
        aria-hidden
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
          'transition-all duration-normal',
          selected ? 'border-p bg-p' : 'border-bd bg-bg group-hover:border-t2'
        )}
      >
        {selected && <Check size={12} strokeWidth={3} className="text-ti" />}
      </div>

      {/* 단어 본문 */}
      <div className="min-w-0 flex-1">
        <div className="mb-[2px] flex items-baseline gap-s-2">
          <span className="font-serif text-base font-bold leading-none text-t1">{word.word}</span>
          <span className="font-mono text-[10px] italic text-t3">{word.partOfSpeech}</span>
        </div>
        <div className="truncate font-body text-xs text-t2">{word.meaning}</div>
      </div>

      {/* 우측: 난이도 chip + 발음 버튼 */}
      <div className="flex shrink-0 items-center gap-s-2">
        {/* 발음 버튼 */}
        {onPlayAudio && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPlayAudio(word.word)
            }}
            aria-label={`${word.word} 발음 듣기`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-t3 opacity-0 transition-colors duration-normal hover:bg-bg hover:text-p group-hover:opacity-100"
          >
            <Volume2 size={13} />
          </button>
        )}

        {/* 난이도 chip */}
        <span
          className={cn(
            'rounded border px-s-2 py-[1px] font-mono text-[10px] font-bold uppercase tracking-wider',
            levelStyle.bg,
            levelStyle.text,
            levelStyle.border
          )}
        >
          {word.level}
        </span>
      </div>
    </div>
  )
}
