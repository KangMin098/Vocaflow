// apps/web/src/lib/srs/rating-mapper.ts
// CLAUDE.md §17.4 — accuracy 기반 FSRS Rating 변환 규칙
// L4a(Flashcard)는 사용자 자가판정, L4b/c/d는 시스템 자동 평가

import { Rating } from './index'
import type { RatingValue } from './index'

/**
 * Accuracy(0~100) → FSRS Rating
 * 한국 학습자 target_retention 0.85 기준
 */
export function accuracyToRating(accuracy: number): RatingValue {
  if (accuracy >= 90) return Rating.Easy
  if (accuracy >= 70) return Rating.Good
  if (accuracy >= 50) return Rating.Hard
  return Rating.Again
}

/**
 * SpellForge 결과 → FSRS Rating (L4b 시각 생성)
 * - 정답 + 힌트 0개 + 오류 0개 → Easy
 * - 정답 + 힌트 1개 이내 + 오류 1개 이내 → Good
 * - 정답이지만 힌트/오류 2개 이상 → Hard
 * - 오답(skip) → Again
 */
export function spellforgeResultToRating(input: {
  finalCorrect: boolean
  hintsUsed: number
  errors: number
}): RatingValue {
  if (!input.finalCorrect) return Rating.Again
  if (input.hintsUsed === 0 && input.errors === 0) return Rating.Easy
  if (input.hintsUsed <= 1 && input.errors <= 1) return Rating.Good
  return Rating.Hard
}

/**
 * ScriptQuiz 단어별 정답 여부 → FSRS Rating (L4d 통합 검증)
 * 시간이 빨랐는지 추가 가중 (timeMs / timeLimitMs)
 */
export function scriptquizResultToRating(input: {
  isCorrect: boolean
  timeMs: number
  timeLimitMs: number
}): RatingValue {
  if (!input.isCorrect) return Rating.Again
  const timeRatio = input.timeMs / input.timeLimitMs
  if (timeRatio < 0.3) return Rating.Easy
  if (timeRatio < 0.7) return Rating.Good
  return Rating.Hard
}
