// apps/web/src/components/flashcard/Card.tsx

'use client'

import type { FlashcardPhase, FlashcardWord } from '@/types/flashcard'
import { useEffect, useState } from 'react'
import { CardBack } from './CardBack'
import { CardFront } from './CardFront'

interface CardProps {
  word: FlashcardWord
  phase: FlashcardPhase
  hintVisible: boolean
  isAudioPlaying: boolean
  isExampleAudioPlaying: boolean
  onPlayAudio: () => void
  onClick: () => void
  swipeDirection: 'left' | 'right' | null
  cardChangeKey: number
}

export function Card({
  word,
  phase,
  hintVisible,
  isAudioPlaying,
  isExampleAudioPlaying,
  onPlayAudio,
  onClick,
  swipeDirection,
  cardChangeKey,
}: CardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [entering, setEntering] = useState(false)

  // 카드 변경 시 entering 애니메이션
  useEffect(() => {
    if (cardChangeKey === 0) return
    setEntering(true)
    const timer = setTimeout(() => setEntering(false), 300)
    return () => clearTimeout(timer)
  }, [cardChangeKey])

  // 카드 변경 시 북마크 reset
  useEffect(() => {
    setIsBookmarked(false)
  }, [word.id])

  const isFlipped = phase === 'flipped' || phase === 'evaluated'
  const isLocked = phase === 'recall' || phase === 'evaluated'

  return (
    <div
      onClick={isLocked ? undefined : onClick}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-label={isFlipped ? '카드 앞면 보기' : '카드 뒤집어 정답 확인'}
      className={`group/card relative h-[380px] w-full ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${swipeDirection === 'left' ? 'animate-[card-out-left_var(--dur-slow)_var(--ease)_forwards]' : ''} ${swipeDirection === 'right' ? 'animate-[card-out-right_var(--dur-slow)_var(--ease)_forwards]' : ''} ${entering ? 'animate-[card-in_var(--dur-slow)_var(--ease-spring)]' : ''} `}
      style={{
        transformStyle: 'preserve-3d',
        transition: `transform var(--dur-flip) var(--ease-flip)`,
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}
    >
      {/* Front Face */}
      <div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 shadow-[var(--sh-card)]"
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <CardFront
          word={word}
          hintVisible={hintVisible}
          showFlipHint={phase === 'flippable'}
          isAudioPlaying={isAudioPlaying}
          onPlayAudio={onPlayAudio}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => setIsBookmarked((b) => !b)}
        />
      </div>

      {/* Back Face */}
      <div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 shadow-[var(--sh-card)]"
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        <CardBack word={word} isExampleAudioPlaying={isExampleAudioPlaying} />
      </div>
    </div>
  )
}
