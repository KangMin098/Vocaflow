// apps/web/src/hooks/useFlashcardSession.ts

'use client'

import { sortByPriority } from '@/lib/srs/sm2'
import type {
  DifficultWord,
  FlashcardPhase,
  FlashcardWord,
  SRSRating,
  SessionStats,
} from '@/types/flashcard'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { clearCursor, resumeIndexFor, saveCursor } from '@/lib/flashcard/session-cursor'

interface UseFlashcardSessionParams {
  initialWords: FlashcardWord[]
}

export function useFlashcardSession({ initialWords }: UseFlashcardSessionParams) {
  // 초기 큐 정렬
  const [queue] = useState(() => sortByPriority(initialWords))
  const [currentIdx, setCurrentIdx] = useState(0)
  const queueIds = useMemo(() => queue.map((w) => w.id), [queue])

  // ── 이어보기 (2026-09-05) ──────────────────────────────────────────
  // 새로고침·뒤로가기로 다시 들어오면 1번 카드부터였다. 저장된 커서가 **같은 큐**를
  // 가리키면 그 자리에서 잇는다(`lib/flashcard/session-cursor.ts`). 첫 렌더는 서버와 같은
  // 0 이어야 하므로(하이드레이션) 마운트 뒤에 옮긴다 — 한 프레임 뒤에 자리가 바뀌는 것이
  // 서버·클라 불일치 경고보다 낫다.
  useEffect(() => {
    const at = resumeIndexFor(queueIds)
    if (at > 0) {
      setCurrentIdx(at)
      setCardChangeKey((k) => k + 1)
    }
  }, [queueIds])
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

  // 다 했으면 커서를 지운다 — 남겨 두면 다음 세션이 "끝" 에서 열려 완료 화면만 보인다.
  useEffect(() => {
    if (isComplete) clearCursor()
  }, [isComplete])

  // SRS 평가
  const submitRating = useCallback(
    (rating: SRSRating) => {
      if (!currentWord) return

      // SRS 전이 계산·영속화는 FlashcardSession 이 pushPendingResult →
      // flushPendingSession 으로 처리한다(서버 권위 재계산). 여기선 뷰 상태만 갱신.

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
    setCurrentIdx((prev) => {
      // 다음 카드로 넘어가는 순간이 저장 시점이다 — 평가 직후가 아니라 "이 카드는 끝났다" 가
      // 확정된 뒤여야 새로고침해도 같은 카드를 두 번 묻지 않는다.
      saveCursor(queueIds, prev + 1)
      return prev + 1
    })
    setPhase('recall')
    setFirstJudge(null)
    setCardChangeKey((k) => k + 1)
  }, [queueIds])

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
