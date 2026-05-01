// apps/web/src/hooks/useFlashcardSession.ts

'use client'

import { calculateNextSRS, sortByPriority } from '@/lib/srs/sm2'
import type {
  DifficultWord,
  FlashcardPhase,
  FlashcardWord,
  SRSRating,
  SessionStats,
} from '@/types/flashcard'
import { useCallback, useMemo, useState } from 'react'

interface UseFlashcardSessionParams {
  initialWords: FlashcardWord[]
}

export function useFlashcardSession({ initialWords }: UseFlashcardSessionParams) {
  // 초기 큐 정렬
  const [queue] = useState(() => sortByPriority(initialWords))
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<FlashcardPhase>('recall')
  const [sessionStartTime] = useState(new Date())

  // 평가 카운트
  const [ratingCounts, setRatingCounts] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  })

  // 어려운 단어 추적
  const [difficultMap, setDifficultMap] = useState<Map<string, number>>(new Map())

  // 1차 평가 결과 (떠올렸나요?)
  const [firstJudge, setFirstJudge] = useState<'yes' | 'no' | null>(null)

  // 카드 변경 트리거 (re-render용)
  const [cardChangeKey, setCardChangeKey] = useState(0)

  const currentWord = queue[currentIdx] ?? null
  const isComplete = currentIdx >= queue.length

  // SRS 평가
  const submitRating = useCallback(
    (rating: SRSRating) => {
      if (!currentWord) return

      // SRS 갱신 (실제 저장은 서버 호출)
      const newSRS = calculateNextSRS(currentWord.srs, rating)
      // TODO: API 호출로 Supabase에 저장
      console.log(`[SRS] ${currentWord.text} → ${rating}`, newSRS)

      // 카운트 갱신
      setRatingCounts((prev) => ({ ...prev, [rating]: prev[rating] + 1 }))

      // 어려운 단어 추적
      if (rating === 'again' || rating === 'hard') {
        setDifficultMap((prev) => {
          const next = new Map(prev)
          next.set(currentWord.id, (next.get(currentWord.id) ?? 0) + 1)
          return next
        })
      }

      setPhase('evaluated')
    },
    [currentWord]
  )

  // 다음 카드 진입
  const goToNextCard = useCallback(() => {
    setCurrentIdx((prev) => prev + 1)
    setPhase('recall')
    setFirstJudge(null)
    setCardChangeKey((k) => k + 1)
  }, [])

  // 1차 평가
  const submitFirstJudge = useCallback((answer: 'yes' | 'no') => {
    setFirstJudge(answer)
    setPhase('flipped')
  }, [])

  // Phase 전환
  const transitionToFlippable = useCallback(() => {
    setPhase('flippable')
  }, [])

  const flipCard = useCallback(() => {
    if (phase !== 'flippable') return
    setPhase('flipped')
  }, [phase])

  // 세션 통계
  const stats: SessionStats = useMemo(() => {
    const difficultWords: DifficultWord[] = Array.from(difficultMap.entries())
      .map(([wordId, count]) => {
        const word = queue.find((w) => w.id === wordId)
        return word ? { word, attemptCount: count } : null
      })
      .filter((d): d is DifficultWord => d !== null)
      .sort((a, b) => b.attemptCount - a.attemptCount)
      .slice(0, 5)

    const totalRated =
      ratingCounts.again + ratingCounts.hard + ratingCounts.good + ratingCounts.easy
    const honestRated = ratingCounts.again + ratingCounts.hard
    const honestyScore = totalRated > 0 ? Math.round((honestRated / totalRated) * 100) : 0

    return {
      totalCards: queue.length,
      studiedCards: currentIdx,
      startTime: sessionStartTime,
      durationSeconds: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000),
      ratingCounts,
      difficultWords,
      honestyScore,
    }
  }, [queue, currentIdx, sessionStartTime, ratingCounts, difficultMap])

  return {
    // 상태
    currentWord,
    currentIdx,
    queue,
    phase,
    firstJudge,
    isComplete,
    cardChangeKey,
    stats,
    // 액션
    transitionToFlippable,
    submitFirstJudge,
    flipCard,
    submitRating,
    goToNextCard,
  }
}
