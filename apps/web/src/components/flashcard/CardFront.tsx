// apps/web/src/components/flashcard/CardFront.tsx

'use client'

import type { FlashcardWord } from '@/types/flashcard'
import { Bookmark, Volume2 } from 'lucide-react'

interface CardFrontProps {
  word: FlashcardWord
  hintVisible: boolean
  showFlipHint: boolean
  isAudioPlaying: boolean
  onPlayAudio: () => void
  isBookmarked: boolean
  onToggleBookmark: () => void
}

export function CardFront({
  word,
  hintVisible,
  showFlipHint,
  isAudioPlaying,
  onPlayAudio,
  isBookmarked,
  onToggleBookmark,
}: CardFrontProps) {
  const firstLetters = word.text.slice(0, 2) + '-'

  return (
    <>
      {/* Meta Row */}
      <div className="mb-6 flex items-center justify-between opacity-50 transition-opacity duration-[var(--dur-normal)] group-hover/card:opacity-100">
        <span className="font-body text-[10px] italic text-[var(--t3)]">{word.textTitle}에서</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleBookmark()
          }}
          aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
          aria-pressed={isBookmarked}
          className={`flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] transition-all duration-[var(--dur-normal)] ${
            isBookmarked
              ? 'text-[var(--active)]'
              : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
          } `}
        >
          <Bookmark
            size={14}
            strokeWidth={1.75}
            fill={isBookmarked ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Word Display */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="mb-3 break-words font-english text-[56px] font-[600] leading-[1.1] tracking-[-0.01em] text-[var(--t1)]">
          {word.text}
        </h2>

        <p className="mb-7 font-mono text-[16px] text-[var(--t3)]">{word.pronunciation}</p>

        {/* Recall Hint Area (1.5초 후 노출) */}
        <div
          className={`mb-4 flex h-6 items-center justify-center gap-1.5 font-body text-[12px] italic text-[var(--t3)] transition-opacity duration-[var(--dur-slow)] ${hintVisible ? 'opacity-100' : 'opacity-0'} `}
          aria-hidden={!hintVisible}
        >
          <span>첫 글자가 떠오르지 않으면:</span>
          <span className="inline-block rounded-[var(--r-sm)] bg-[var(--p-light)] px-2 py-0.5 font-english text-[14px] font-[700] not-italic tracking-[0.04em] text-[var(--p)]">
            {firstLetters}
          </span>
        </div>

        {/* Audio Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPlayAudio()
          }}
          aria-label="발음 듣기"
          className="inline-flex items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] px-5 py-2.5 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:-translate-y-px hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--p)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.15)]"
        >
          <Volume2
            size={14}
            strokeWidth={2}
            className={isAudioPlaying ? 'animate-[audio-pulse_0.8s_ease-in-out_infinite]' : ''}
            aria-hidden="true"
          />
          <span>발음 듣기</span>
        </button>
      </div>

      {/* Flip Hint */}
      <p
        className={`mt-3 flex h-4 items-center justify-center gap-2 text-center font-display text-[10px] font-[600] uppercase tracking-[0.10em] text-[var(--t3)] opacity-60 transition-opacity duration-[var(--dur-normal)] ${showFlipHint ? 'opacity-60' : 'pointer-events-none opacity-0'} `}
      >
        <span>탭 또는</span>
        <kbd className="rounded border border-[var(--bd)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
          Space
        </kbd>
        <span>로 정답 확인</span>
      </p>
    </>
  )
}
