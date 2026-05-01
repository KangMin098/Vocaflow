// apps/web/src/components/flashcard/FlashcardSession.tsx

'use client'

import { useEffect, useState } from 'react'

import { useFlashcardSession } from '@/hooks/useFlashcardSession'
import type { FlashcardWord, PauseMessage, SRSRating } from '@/types/flashcard'

import { Card } from './Card'
import { CompletionState } from './CompletionState'
import { FirstJudge } from './FirstJudge'
import { HonestyHint } from './HonestyHint'
import { MicroPause } from './MicroPause'
import { RecallPhase } from './RecallPhase'
import { SRSBar } from './SRSBar'

const RECALL_DURATION_MS = 3000
const HINT_DELAY_MS = 1500
const SWIPE_DURATION_MS = 300
const MICRO_PAUSE_MS = 700
const AUDIO_FAKE_DURATION_MS = 800

const PAUSE_MESSAGES: PauseMessage[] = [
  { icon: '🌱', text: '잘하고 있어요. 계속해요.' },
  { icon: '✨', text: '한 단어, 한 단어 차분히.' },
  { icon: '💫', text: '천천히 깊이 만나요.' },
  { icon: '🌿', text: '편안한 마음으로 다음 단어를.' },
]

interface FlashcardSessionProps {
  initialWords: FlashcardWord[]
}

export function FlashcardSession({ initialWords }: FlashcardSessionProps) {
  const session = useFlashcardSession({ initialWords })
  const {
    currentWord,
    currentIdx,
    queue,
    phase,
    isComplete,
    cardChangeKey,
    stats,
    transitionToFlippable,
    submitFirstJudge,
    flipCard,
    submitRating,
    goToNextCard,
  } = session

  // ── 뷰 상태 ──
  const [recallProgress, setRecallProgress] = useState(0)
  const [hintVisible, setHintVisible] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [pauseVisible, setPauseVisible] = useState(false)
  const [pauseMessage, setPauseMessage] = useState<PauseMessage>(PAUSE_MESSAGES[0])
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isExampleAudioPlaying] = useState(false)

  // 학습 모드 — 사이드바 dim
  useEffect(() => {
    document.body.classList.add('studying')
    return () => document.body.classList.remove('studying')
  }, [])

  // Recall 타이머: 3초 진행 후 flippable로 전환, 1.5초 시점부터 힌트 노출
  useEffect(() => {
    if (phase !== 'recall' || isComplete) {
      setRecallProgress(0)
      setHintVisible(false)
      return
    }
    const start = Date.now()
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - start
      setRecallProgress(Math.min(100, (elapsed / RECALL_DURATION_MS) * 100))
      if (elapsed >= HINT_DELAY_MS) setHintVisible(true)
      if (elapsed >= RECALL_DURATION_MS) {
        window.clearInterval(intervalId)
        transitionToFlippable()
      }
    }, 50)
    return () => window.clearInterval(intervalId)
  }, [phase, isComplete, cardChangeKey, transitionToFlippable])

  // SRS 평가 후: 스와이프 → 마지막 카드는 즉시 완료, 그 외는 마이크로 폴즈
  useEffect(() => {
    if (phase !== 'evaluated') return

    const swipeTimer = window.setTimeout(() => {
      const isLastCard = currentIdx >= queue.length - 1
      if (isLastCard) {
        goToNextCard() // → isComplete 트리거
        return
      }
      setPauseMessage(PAUSE_MESSAGES[Math.floor(Math.random() * PAUSE_MESSAGES.length)])
      setPauseVisible(true)
    }, SWIPE_DURATION_MS)

    return () => window.clearTimeout(swipeTimer)
  }, [phase, currentIdx, queue.length, goToNextCard])

  // 마이크로 폴즈 종료 후 다음 카드
  useEffect(() => {
    if (!pauseVisible) return
    const timer = window.setTimeout(() => {
      setPauseVisible(false)
      setSwipeDirection(null)
      goToNextCard()
    }, MICRO_PAUSE_MS)
    return () => window.clearTimeout(timer)
  }, [pauseVisible, goToNextCard])

  // 카드 변경 시 스와이프 방향 리셋
  useEffect(() => {
    setSwipeDirection(null)
  }, [cardChangeKey])

  // SRS 평가 — 스와이프 방향 결정 + 훅 호출
  const handleSRSRating = (rating: SRSRating) => {
    setSwipeDirection(rating === 'again' || rating === 'hard' ? 'left' : 'right')
    submitRating(rating)
  }

  // 발음 재생 (mock — Phase 2에서 OpenAI TTS로 교체)
  const handlePlayAudio = () => {
    setIsAudioPlaying(true)
    window.setTimeout(() => setIsAudioPlaying(false), AUDIO_FAKE_DURATION_MS)
  }

  // 키보드 단축키
  useEffect(() => {
    if (isComplete) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (phase === 'flippable') {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault()
          flipCard()
        }
      } else if (phase === 'flipped') {
        if (e.key === '1') handleSRSRating('again')
        else if (e.key === '2') handleSRSRating('hard')
        else if (e.key === '3') handleSRSRating('good')
        else if (e.key === '4') handleSRSRating('easy')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, isComplete, flipCard]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestart = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  if (isComplete || !currentWord) {
    return (
      <CompletionState
        stats={stats}
        textId={initialWords[0]?.textId ?? '1'}
        onRestart={handleRestart}
      />
    )
  }

  const recallLabel = recallProgress < 100 ? '머리 속에서 뜻을 떠올려보세요' : '떠올리셨나요?'

  return (
    <section
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg2)] px-6 py-10"
      aria-label="플래시카드 학습"
    >
      <RecallPhase
        visible={phase === 'recall' || phase === 'flippable'}
        progress={recallProgress}
        label={recallLabel}
      />

      <div className="w-full max-w-[540px]" style={{ perspective: '1500px' }}>
        <Card
          word={currentWord}
          phase={phase}
          hintVisible={hintVisible}
          isAudioPlaying={isAudioPlaying}
          isExampleAudioPlaying={isExampleAudioPlaying}
          onPlayAudio={handlePlayAudio}
          onClick={flipCard}
          swipeDirection={swipeDirection}
          cardChangeKey={cardChangeKey}
        />
      </div>

      <FirstJudge visible={phase === 'flippable'} onJudge={submitFirstJudge} />

      <SRSBar visible={phase === 'flipped'} srs={currentWord.srs} onJudge={handleSRSRating} />

      <HonestyHint visible={phase === 'flipped'} />

      <p
        className="mt-6 font-mono text-[12px] text-[var(--t3)]"
        aria-label={`${currentIdx + 1}번째 카드, 총 ${queue.length}개`}
      >
        <strong className="font-[700] text-[var(--t1)]">{currentIdx + 1}</strong>
        {' / '}
        {queue.length}
      </p>

      <MicroPause
        visible={pauseVisible}
        message={pauseMessage}
        currentIdx={currentIdx}
        total={queue.length}
      />
    </section>
  )
}
