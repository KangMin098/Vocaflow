// apps/web/src/components/flashcard/FlashcardSession.tsx

'use client'

import { useEffect, useRef, useState } from 'react'

import { useFlashcardSession } from '@/hooks/useFlashcardSession'
import { useNextAction } from '@/lib/recommend/use-next-action'
import { useSrsFlushOnLeave } from '@/hooks/useSrsFlushOnLeave'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { flushPendingSession } from '@/lib/srs/flush-session'
import { Rating, applyReview, type RatingValue } from '@/lib/srs'
import { pushPendingResult } from '@/lib/srs/session-storage'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import type { FlashcardWord, PauseMessage, SRSRating } from '@/types/flashcard'

import { Card } from './Card'
import { CompletionState } from './CompletionState'
import { FirstJudge } from './FirstJudge'
import type { ContentRef } from '@/lib/content/content-ref'
import { HonestyHint } from './HonestyHint'
import { MicroPause } from './MicroPause'
import { RecallPhase } from './RecallPhase'
import { SRSBar } from './SRSBar'

// CLAUDE.md §17.4 — FSRS 4단계 1:1 매핑
const SRS_RATING_TO_FSRS: Record<SRSRating, RatingValue> = {
  again: Rating.Again, // 1
  hard: Rating.Hard, // 2
  good: Rating.Good, // 3
  easy: Rating.Easy, // 4
}

const RECALL_DURATION_MS = 3000
const HINT_DELAY_MS = 1500
const SWIPE_DURATION_MS = 300
const MICRO_PAUSE_MS = 700

const PAUSE_MESSAGES: PauseMessage[] = [
  { icon: '🌱', text: '잘하고 있어요. 계속해요.' },
  { icon: '✨', text: '한 단어, 한 단어 차분히.' },
  { icon: '💫', text: '천천히 깊이 만나요.' },
  { icon: '🌿', text: '편안한 마음으로 다음 단어를.' },
]

interface FlashcardSessionProps {
  initialWords: FlashcardWord[]
  /** 세션 종료 시 복귀 경로 — 페이지가 ?from/스코프로 계산해 주입 (기본 hub). */
  backHref?: string
  /** 무엇으로 학습했나 — 완주 기록의 콘텐츠 귀속. 페이지가 스코프에서 계산해 주입. */
  content?: ContentRef
}

export function FlashcardSession({
  initialWords,
  backHref = '/flashcard',
  content,
}: FlashcardSessionProps) {
  // §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) — 실 사용자 상태 기반 (decide P1~P4)
  const recommendation = useNextAction()

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
  // 발음은 브라우저 음성 합성이다 — 재생 상태도 훅이 갖는다(로컬 타이머로 흉내 내지 않는다).
  const {
    speak,
    isPlaying: isAudioPlaying,
    supported: speechSupported,
  } = useSpeechSynthesis()
  const [isExampleAudioPlaying] = useState(false)

  // 학습 모드 — 사이드바 dim
  useEffect(() => {
    document.body.classList.add('studying')
    return () => document.body.classList.remove('studying')
  }, [])

  // 세션 종료 시 SRS 큐 → DB flush (멱등 가드, 1회).
  const flushedRef = useRef(false)
  useEffect(() => {
    if (isComplete && !flushedRef.current) {
      flushedRef.current = true
      void flushPendingSession()
    }
  }, [isComplete])

  // **완주하지 않고 떠나도** 평가가 남는다 — ✕ · Esc · 뒤로가기 · 사이드바 이동 · 탭 닫기.
  // 완주 flush 와 겹칠 수 있으나 서버가 멱등하다(`lib/srs/flush-actions.ts`).
  useSrsFlushOnLeave()

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

  // SRS 평가 — 스와이프 방향 결정 + 훅 호출 + (있다면) FSRS applyReview
  const handleSRSRating = (rating: SRSRating) => {
    setSwipeDirection(rating === 'again' || rating === 'hard' ? 'left' : 'right')

    // §17 [4] 기억 축 — FSRS 경로. srsV2 없으면 SM-2만 동작 (호환성).
    if (currentWord?.srsV2) {
      const result = applyReview({
        card: currentWord.srsV2,
        rating: SRS_RATING_TO_FSRS[rating],
        reviewedAt: new Date(),
        module: 'flashcard',
      })
      // DB 연동 전 임시 큐. 연동 후엔 supabase.from('vocabularies').update(...) 직접 호출.
      pushPendingResult({
        cardId: result.card.id,
        word: currentWord.text,
        cardUpdate: cardToUpdatePayload(result.card),
        rating: result.log.rating,
        reviewedAt: result.log.reviewedAt.toISOString(),
        module: result.log.module,
      })
    }

    submitRating(rating)
  }

  /**
   * 발음 재생.
   *
   * ⚠️ 2026-09-05 전까지 이 함수는 **아무 소리도 내지 않았다** — 800ms 동안 재생 아이콘만
   *    켰다 끄는 타이머였다("mock — Phase 2에서 OpenAI TTS로 교체"). 학습자에게는 스피커가
   *    눌리고 애니메이션까지 도는데 소리가 안 나는 것으로 보인다(이어폰·볼륨을 의심하게 된다).
   *    이 저장소의 발음은 브라우저 음성 합성이고 단어장 학습 화면은 이미 그것을 쓰고 있었다 —
   *    Dual Coding(언어+청각)은 4철학의 하나인데 이 모듈에서만 빠져 있던 셈이다.
   *
   * 지원하지 않는 브라우저에서는 버튼 자체를 그리지 않는다(`canPlayAudio`) —
   * **눌러도 안 되는 버튼을 두지 않는다.**
   */
  const handlePlayAudio = () => {
    if (!currentWord || !speechSupported) return
    speak(currentWord.text)
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
        backHref={backHref}
        content={content}
        onRestart={handleRestart}
        recommendation={recommendation}
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
          canPlayAudio={speechSupported}
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
        className="mt-6 font-mono text-[12px] text-[var(--t2)]"
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
