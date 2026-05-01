// apps/web/src/hooks/useSpellForgeSession.ts

'use client'

import { aggregatePatterns, extractTypoPattern } from '@/lib/spellforge/typoPattern'
import type { SpellForgeRating, SpellForgeSession, SpellForgeWord } from '@/types/spellforge'
import { useCallback, useRef, useState } from 'react'

interface UseSessionParams {
  textId: string
  words: SpellForgeWord[]
}

export function useSpellForgeSession({ textId, words }: UseSessionParams) {
  const [session, setSession] = useState<SpellForgeSession>(() => ({
    textId,
    words,
    currentIdx: 0,
    mode: 'delayed',
    startedAt: new Date(),
    totalAttempts: 0,
    totalCorrect: 0,
    totalErrors: 0,
    totalHints: 0,
    typoPatterns: [],
  }))

  const wordStartTimeRef = useRef<number>(Date.now())

  const currentWord = session.words[session.currentIdx]

  /**
   * 단어 평가 결과 기록
   */
  const recordRating = useCallback((rating: SpellForgeRating, userInput?: string) => {
    setSession((prev) => {
      // 오타 패턴 분석
      let newPatterns = prev.typoPatterns
      if (userInput && !rating.finalCorrect) {
        const target = prev.words[prev.currentIdx].text
        const newTypos = extractTypoPattern(userInput, target)
        newPatterns = aggregatePatterns(prev.typoPatterns, newTypos, target)
      }

      return {
        ...prev,
        totalAttempts: prev.totalAttempts + rating.attempts,
        totalCorrect: prev.totalCorrect + (rating.finalCorrect ? 1 : 0),
        totalErrors: prev.totalErrors + rating.errors,
        totalHints: prev.totalHints + rating.hintsUsed,
        typoPatterns: newPatterns,
      }
    })

    // TODO: Supabase 저장
    // await saveRatingToDB(rating);
  }, [])

  /**
   * 다음 단어로
   */
  const nextWord = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      currentIdx: Math.min(prev.currentIdx + 1, prev.words.length - 1),
    }))
    wordStartTimeRef.current = Date.now()
  }, [])

  /**
   * 단어 건너뛰기
   */
  const skipWord = useCallback(() => {
    nextWord()
  }, [nextWord])

  /**
   * 현재 단어에 머무는 시간
   */
  const getTimeSpent = useCallback(() => {
    return Date.now() - wordStartTimeRef.current
  }, [])

  /**
   * 세션 완료 여부
   */
  const isComplete = session.currentIdx >= session.words.length - 1

  return {
    session,
    currentWord,
    recordRating,
    nextWord,
    skipWord,
    getTimeSpent,
    isComplete,
  }
}
