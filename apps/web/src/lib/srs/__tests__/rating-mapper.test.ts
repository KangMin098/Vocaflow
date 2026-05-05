// apps/web/src/lib/srs/__tests__/rating-mapper.test.ts
// rating-mapper.ts 단위 테스트

import { describe, it, expect } from 'vitest'
import {
  accuracyToRating,
  spellforgeResultToRating,
  scriptquizResultToRating,
} from '../rating-mapper'
import { Rating } from '../index'

describe('accuracyToRating', () => {
  it('≥90 → Easy', () => {
    expect(accuracyToRating(95)).toBe(Rating.Easy)
    expect(accuracyToRating(90)).toBe(Rating.Easy)
    expect(accuracyToRating(100)).toBe(Rating.Easy)
  })
  it('70~89 → Good', () => {
    expect(accuracyToRating(89)).toBe(Rating.Good)
    expect(accuracyToRating(85)).toBe(Rating.Good)
    expect(accuracyToRating(70)).toBe(Rating.Good)
  })
  it('50~69 → Hard', () => {
    expect(accuracyToRating(69)).toBe(Rating.Hard)
    expect(accuracyToRating(60)).toBe(Rating.Hard)
    expect(accuracyToRating(50)).toBe(Rating.Hard)
  })
  it('<50 → Again', () => {
    expect(accuracyToRating(49)).toBe(Rating.Again)
    expect(accuracyToRating(40)).toBe(Rating.Again)
    expect(accuracyToRating(0)).toBe(Rating.Again)
  })
})

describe('spellforgeResultToRating', () => {
  it('정답 + 힌트 0 + 오류 0 → Easy', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 0, errors: 0 })).toBe(
      Rating.Easy
    )
  })
  it('정답 + 힌트 1 + 오류 0 → Good', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 1, errors: 0 })).toBe(
      Rating.Good
    )
  })
  it('정답 + 힌트 0 + 오류 1 → Good', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 0, errors: 1 })).toBe(
      Rating.Good
    )
  })
  it('정답 + 힌트 2 → Hard', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 2, errors: 0 })).toBe(
      Rating.Hard
    )
  })
  it('정답 + 오류 3 → Hard', () => {
    expect(spellforgeResultToRating({ finalCorrect: true, hintsUsed: 0, errors: 3 })).toBe(
      Rating.Hard
    )
  })
  it('오답 → Again (힌트/오류 무관)', () => {
    expect(spellforgeResultToRating({ finalCorrect: false, hintsUsed: 0, errors: 0 })).toBe(
      Rating.Again
    )
    expect(spellforgeResultToRating({ finalCorrect: false, hintsUsed: 3, errors: 5 })).toBe(
      Rating.Again
    )
  })
})

describe('scriptquizResultToRating', () => {
  it('정답 + 빠른 응답(<30%) → Easy', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 2000, timeLimitMs: 10000 })).toBe(
      Rating.Easy
    )
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 0, timeLimitMs: 10000 })).toBe(
      Rating.Easy
    )
  })
  it('정답 + 보통 응답(30~70%) → Good', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 3000, timeLimitMs: 10000 })).toBe(
      Rating.Good
    )
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 6900, timeLimitMs: 10000 })).toBe(
      Rating.Good
    )
  })
  it('정답 + 느린 응답(≥70%) → Hard', () => {
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 8000, timeLimitMs: 10000 })).toBe(
      Rating.Hard
    )
    expect(scriptquizResultToRating({ isCorrect: true, timeMs: 9999, timeLimitMs: 10000 })).toBe(
      Rating.Hard
    )
  })
  it('오답 → Again (시간 무관)', () => {
    expect(scriptquizResultToRating({ isCorrect: false, timeMs: 1000, timeLimitMs: 10000 })).toBe(
      Rating.Again
    )
    expect(scriptquizResultToRating({ isCorrect: false, timeMs: 9999, timeLimitMs: 10000 })).toBe(
      Rating.Again
    )
  })
})
