// apps/web/src/types/spellforge.ts

import type { Word } from './library'

export type SpellForgeMode = 'realtime' | 'delayed' | 'blind'

export type IMEStatus = 'en' | 'ko-warning' | 'ko-error'

export type SlotState = 'empty' | 'current' | 'typed' | 'correct' | 'error' | 'hint-flash'

export interface SpellForgeWord extends Word {
  // 학습 통계
  attemptsThisSession?: number
  errorsThisSession?: number
  hintsUsedThisSession?: number
}

export interface SpellForgeSession {
  textId: string
  words: SpellForgeWord[]
  currentIdx: number
  mode: SpellForgeMode
  startedAt: Date
  totalAttempts: number
  totalCorrect: number
  totalErrors: number
  totalHints: number
  typoPatterns: TypoPattern[]
}

export interface TypoPattern {
  wrong: string
  correct: string
  count: number
  examples: string[]
}

export interface SpellForgeRating {
  wordId: string
  attempts: number
  errors: number
  hintsUsed: number
  finalCorrect: boolean
  timeSpentMs: number
}

export interface ConfirmResult {
  correct: boolean
  correctChars: number
  totalChars: number
  accuracy: number
  errorPositions: number[]
}

export type Phase = 'typing' | 'success' | 'paused' | 'error'
