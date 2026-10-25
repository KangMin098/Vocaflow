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
  canPlayAudio: boolean
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
  canPlayAudio,
  onClick,
  swipeDirection,
  cardChangeKey,
}: CardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [entering, setEntering] = useState(false)
  const [desktopLearner, setDesktopLearner] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktopLearner(query.matches && !!document.querySelector('[data-learner-pc-color="tines"]'))
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

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
    // 카드 면 전체는 마우스 클릭 면이다. 역할(role="button")은 주지 않는다 — 안에 북마크·발음·삽화 버튼이 있어
    // 상호작용 안의 상호작용(axe nested-interactive)이 된다. 키보드·보조기기의 뒤집기 컨트롤은 앞면 낱말
    // 버튼(CardFront `data-card-flip`)이고, 그 클릭이 여기로 올라와 같은 onClick 을 탄다.
    <div
      onClick={isLocked ? undefined : onClick}
      data-learner-flashcard
      className={`group/card relative h-[380px] w-full ${isLocked ? 'cursor-default' : 'cursor-pointer'} ${swipeDirection === 'left' ? 'animate-[card-out-left_var(--dur-slow)_var(--ease)_forwards]' : ''} ${swipeDirection === 'right' ? 'animate-[card-out-right_var(--dur-slow)_var(--ease)_forwards]' : ''} ${entering ? 'animate-[card-in_var(--dur-slow)_var(--ease-spring)]' : ''} `}
      style={{
        transformStyle: 'preserve-3d',
        transition: `transform var(--dur-flip) var(--ease-flip)`,
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}
    >
      {/* Front Face */}
      <div
        data-card-face="front"
        aria-hidden={desktopLearner ? isFlipped : undefined}
        ref={node => { if (node) node.inert = desktopLearner && isFlipped }}
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
          flipLocked={isLocked}
          isAudioPlaying={isAudioPlaying}
          canPlayAudio={canPlayAudio}
          onPlayAudio={onPlayAudio}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => setIsBookmarked((b) => !b)}
        />
      </div>

      {/* Back Face */}
      <div
        data-card-face="back"
        aria-hidden={desktopLearner ? !isFlipped : undefined}
        ref={node => { if (node) node.inert = desktopLearner && !isFlipped }}
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 shadow-[var(--sh-card)]"
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        <CardBack word={word} isExampleAudioPlaying={isExampleAudioPlaying} desktopLearner={desktopLearner} />
      </div>
    </div>
  )
}
