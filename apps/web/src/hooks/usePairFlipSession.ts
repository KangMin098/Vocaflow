// apps/web/src/hooks/usePairFlipSession.ts
// PairFlip 세션 상태 머신 — 카드 클릭, 매칭 검증, 콤보, 점수, 타이머

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  PAIRFLIP_LEVELS,
  PAIRFLIP_SCORE,
  getComboMultiplier,
  pairAttemptsToFSRSRating,
} from '@/components/pairflip/constants'
import { buildPairFlipCards, MOCK_PAIRS } from '@/components/pairflip/mock-data'
import { PF_DIMS } from '@/components/pairflip/theme'
import type {
  PairFlipLevel,
  PairFlipMode,
  PairFlipPairResult,
  PairFlipPhase,
  PairFlipResultData,
  PairFlipSession,
} from '@/components/pairflip/types'

interface UsePairFlipSessionOptions {
  level: PairFlipLevel
  mode: PairFlipMode
  onComplete?: (result: PairFlipResultData) => void
}

export function usePairFlipSession({ level, mode, onComplete }: UsePairFlipSessionOptions) {
  const config = useMemo(
    () => PAIRFLIP_LEVELS.find((l) => l.id === level) ?? PAIRFLIP_LEVELS[1],
    [level],
  )

  // 초기 카드 — pair 수만큼 mock 에서 추출 후 셔플
  const initialCards = useMemo(() => {
    const pairs = MOCK_PAIRS.slice(0, config.pairCount)
    return buildPairFlipCards(pairs)
  }, [config.pairCount])

  const [session, setSession] = useState<PairFlipSession>(() => ({
    level,
    mode,
    cards: initialCards,
    startedAt: Date.now(),
    matchedPairs: 0,
    totalAttempts: 0,
    combo: 0,
    maxCombo: 0,
    hintsUsed: 0,
    score: 0,
    phase: 'idle',
    selectedCardIds: [],
    pairResults: [],
  }))

  const [remainingTime, setRemainingTime] = useState(config.timeLimit)
  const completedRef = useRef(false)

  // ── 타이머 ───────────────────────────────────────────────────
  useEffect(() => {
    if (session.phase === 'won' || session.phase === 'lost') return
    const interval = setInterval(() => {
      setRemainingTime((t) => {
        if (t <= 1) {
          clearInterval(interval)
          setSession((s) =>
            s.phase === 'won' || s.phase === 'lost'
              ? s
              : { ...s, phase: 'lost', endedAt: Date.now() },
          )
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [session.phase])

  // ── 종료 시 onComplete 호출 ───────────────────────────────────
  useEffect(() => {
    if (session.phase !== 'won' && session.phase !== 'lost') return
    if (completedRef.current) return
    completedRef.current = true

    const finalScore = (() => {
      let s = session.score
      if (session.phase === 'won') {
        s += remainingTime * PAIRFLIP_SCORE.timeBonus
        if (
          session.totalAttempts === session.matchedPairs &&
          session.hintsUsed === 0
        ) {
          s += PAIRFLIP_SCORE.perfectBonus
        }
      }
      return Math.max(0, s)
    })()

    const result: PairFlipResultData = {
      level,
      mode,
      totalPairs: config.pairCount,
      matchedPairs: session.matchedPairs,
      totalAttempts: session.totalAttempts,
      maxCombo: session.maxCombo,
      hintsUsed: session.hintsUsed,
      score: finalScore,
      durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
      pairResults: session.pairResults,
      phase: session.phase,
    }
    onComplete?.(result)
  }, [session, level, mode, config.pairCount, remainingTime, onComplete])

  // ── 카드 클릭 핸들러 ─────────────────────────────────────────
  const handleCardClick = useCallback(
    (cardId: string) => {
      setSession((s) => {
        if (s.phase === 'won' || s.phase === 'lost') return s
        if (s.phase === 'matched' || s.phase === 'mismatched') return s

        const card = s.cards.find((c) => c.id === cardId)
        if (!card) return s
        if (card.state !== 'covered') return s

        // 첫 카드 클릭
        if (s.phase === 'idle') {
          return {
            ...s,
            phase: 'reveal_first',
            selectedCardIds: [cardId],
            cards: s.cards.map((c) =>
              c.id === cardId ? { ...c, state: 'flipped', attempts: c.attempts + 1 } : c,
            ),
          }
        }

        // 두 번째 카드 클릭
        if (s.phase === 'reveal_first') {
          const firstId = s.selectedCardIds[0]
          if (firstId === cardId) return s
          const first = s.cards.find((c) => c.id === firstId)
          if (!first) return s

          const flippedCards = s.cards.map((c) =>
            c.id === cardId ? { ...c, state: 'flipped' as const, attempts: c.attempts + 1 } : c,
          )

          const isMatch = first.pairId === card.pairId
          const newAttempts = s.totalAttempts + 1

          if (isMatch) {
            const newCombo = s.combo + 1
            const multiplier = getComboMultiplier(newCombo)
            const gain = Math.round(PAIRFLIP_SCORE.matchBase * multiplier)
            const newMatchedPairs = s.matchedPairs + 1

            const wordCard = first.type === 'word' ? first : card
            const meaningCard = first.type === 'meaning' ? first : card
            const pairResult: PairFlipPairResult = {
              pairId: card.pairId,
              word: wordCard.content,
              meaning: meaningCard.content,
              attempts: Math.max(first.attempts + 1, card.attempts + 1),
              matchedAt: Date.now(),
              fsrsRating: pairAttemptsToFSRSRating(
                Math.max(first.attempts + 1, card.attempts + 1),
                true,
              ),
            }

            const isWon = newMatchedPairs >= config.pairCount

            return {
              ...s,
              phase: isWon ? 'matched' : 'matched',
              cards: flippedCards.map((c) =>
                c.id === firstId || c.id === cardId
                  ? { ...c, state: 'matched' as const }
                  : c,
              ),
              matchedPairs: newMatchedPairs,
              totalAttempts: newAttempts,
              combo: newCombo,
              maxCombo: Math.max(s.maxCombo, newCombo),
              score: s.score + gain,
              selectedCardIds: [],
              pairResults: [...s.pairResults, pairResult],
            }
          }

          return {
            ...s,
            phase: 'mismatched',
            cards: flippedCards.map((c) =>
              c.id === firstId || c.id === cardId ? { ...c, state: 'shaking' as const } : c,
            ),
            totalAttempts: newAttempts,
            combo: 0,
            selectedCardIds: [firstId, cardId],
          }
        }

        return s
      })
    },
    [config.pairCount],
  )

  // ── matched / mismatched 자동 전환 ──────────────────────────
  useEffect(() => {
    if (session.phase === 'matched') {
      const t = setTimeout(() => {
        setSession((s) => {
          if (s.phase !== 'matched') return s
          const allMatched = s.matchedPairs >= config.pairCount
          return {
            ...s,
            // v06.17.2: 매칭된 카드는 사라지지 않고 그대로 유지 (state='matched' 유지).
            // phase 만 idle 로 돌려 다음 클릭 가능하게.
            phase: allMatched ? 'won' : 'idle',
            endedAt: allMatched ? Date.now() : s.endedAt,
          }
        })
      }, PF_DIMS.matchedCelebrateDuration ?? PF_DIMS.matchedDuration)
      return () => clearTimeout(t)
    }

    if (session.phase === 'mismatched') {
      const t = setTimeout(() => {
        setSession((s) => {
          if (s.phase !== 'mismatched') return s
          return {
            ...s,
            phase: 'idle',
            cards: s.cards.map((c) =>
              c.state === 'shaking' ? { ...c, state: 'covered' } : c,
            ),
            selectedCardIds: [],
          }
        })
      }, PF_DIMS.mismatchHoldDuration)
      return () => clearTimeout(t)
    }
  }, [session.phase, config.pairCount])

  // ── 힌트 사용 — 무작위 매칭 안 된 쌍 1초 reveal ─────────────
  const useHint = useCallback(() => {
    setSession((s) => {
      if (s.hintsUsed >= 2) return s
      if (s.phase !== 'idle' && s.phase !== 'reveal_first') return s

      const remainingPairs = Array.from(
        new Set(
          s.cards.filter((c) => c.state === 'covered').map((c) => c.pairId),
        ),
      )
      if (remainingPairs.length === 0) return s
      const pickedPairId = remainingPairs[Math.floor(Math.random() * remainingPairs.length)]
      const pickedCardIds = s.cards
        .filter((c) => c.pairId === pickedPairId && c.state === 'covered')
        .map((c) => c.id)

      return {
        ...s,
        hintsUsed: s.hintsUsed + 1,
        score: Math.max(0, s.score + PAIRFLIP_SCORE.hintPenalty),
        cards: s.cards.map((c) =>
          pickedCardIds.includes(c.id) ? { ...c, state: 'flipped' } : c,
        ),
      }
    })
    setTimeout(() => {
      setSession((s) => ({
        ...s,
        cards: s.cards.map((c) => {
          // 힌트로 노출된 카드만 다시 covered (매칭 등 다른 상태 변경은 보존)
          if (c.state === 'flipped' && !s.selectedCardIds.includes(c.id)) {
            return { ...c, state: 'covered' as const }
          }
          return c
        }),
      }))
    }, 1000)
  }, [])

  // ── 헬퍼: 현재 phase 가 카드 클릭 가능한지 ─────────────────
  const canClick: PairFlipPhase[] = ['idle', 'reveal_first']
  const isClickable = canClick.includes(session.phase)

  return {
    session,
    config,
    remainingTime,
    handleCardClick,
    useHint,
    isClickable,
  }
}
