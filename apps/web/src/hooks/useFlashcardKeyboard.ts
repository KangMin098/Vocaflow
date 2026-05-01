// apps/web/src/hooks/useFlashcardKeyboard.ts

'use client'

import type { FlashcardPhase, SRSRating } from '@/types/flashcard'
import { useEffect } from 'react'

interface UseFlashcardKeyboardParams {
  phase: FlashcardPhase
  onFlip: () => void
  onJudge: (rating: SRSRating) => void
  onPlayAudio: () => void
  onToggleInsight: () => void
  onEscape: () => void
}

const RATING_KEYS: Record<string, SRSRating> = {
  '1': 'again',
  '2': 'hard',
  '3': 'good',
  '4': 'easy',
}

export function useFlashcardKeyboard({
  phase,
  onFlip,
  onJudge,
  onPlayAudio,
  onToggleInsight,
  onEscape,
}: UseFlashcardKeyboardParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (target.isContentEditable) return

      const isCmd = e.metaKey || e.ctrlKey

      // Cmd+. → Insight
      if (isCmd && e.key === '.') {
        e.preventDefault()
        onToggleInsight()
        return
      }

      // Esc → close all
      if (e.key === 'Escape') {
        onEscape()
        return
      }

      // Space → flip
      if (e.code === 'Space' && phase === 'flippable') {
        e.preventDefault()
        onFlip()
        return
      }

      // 1~4 → SRS judge (only if flipped)
      if (phase === 'flipped' && RATING_KEYS[e.key]) {
        e.preventDefault()
        onJudge(RATING_KEYS[e.key])
        return
      }

      // R → replay audio
      if (e.key.toLowerCase() === 'r' && !isCmd) {
        e.preventDefault()
        onPlayAudio()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [phase, onFlip, onJudge, onPlayAudio, onToggleInsight, onEscape])
}
