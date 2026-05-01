// apps/web/src/lib/srs/sm2.ts

import type { SRSRating, SRSState } from '@/types/flashcard'

/**
 * SuperMemo SM-2 단순화 버전 (Anki-style)
 *
 * Easiness Factor (EF):
 *   - 초기값: 2.5
 *   - 최소값: 1.3
 *   - Again 시 -0.20
 *   - Hard 시 -0.15
 *   - Good 시 유지
 *   - Easy 시 +0.15
 *
 * Interval (일):
 *   - Again: 1분 (1/1440 일)
 *   - Hard: 6분 (6/1440 일)
 *   - Good: 1일 → 6일 → interval × EF
 *   - Easy: interval × EF × 1.3
 */

const MIN_EF = 1.3
const DEFAULT_EF = 2.5

const ONE_MINUTE_DAYS = 1 / 1440
const SIX_MINUTES_DAYS = 6 / 1440

export function createInitialSRS(): SRSState {
  return {
    easinessFactor: DEFAULT_EF,
    interval: 0,
    repetitions: 0,
    nextReviewAt: new Date(),
    lapses: 0,
  }
}

export function calculateNextSRS(state: SRSState, rating: SRSRating): SRSState {
  const newState: SRSState = { ...state }

  switch (rating) {
    case 'again': {
      newState.repetitions = 0
      newState.interval = ONE_MINUTE_DAYS
      newState.easinessFactor = Math.max(MIN_EF, state.easinessFactor - 0.2)
      newState.lapses = state.lapses + 1
      break
    }

    case 'hard': {
      newState.repetitions = state.repetitions
      newState.interval = SIX_MINUTES_DAYS
      newState.easinessFactor = Math.max(MIN_EF, state.easinessFactor - 0.15)
      break
    }

    case 'good': {
      newState.repetitions = state.repetitions + 1
      if (newState.repetitions === 1) {
        newState.interval = 1 // 1일
      } else if (newState.repetitions === 2) {
        newState.interval = 6 // 6일
      } else {
        newState.interval = state.interval * state.easinessFactor
      }
      // EF 유지
      break
    }

    case 'easy': {
      newState.repetitions = state.repetitions + 1
      if (newState.repetitions === 1) {
        newState.interval = 4
      } else {
        newState.interval = state.interval * state.easinessFactor * 1.3
      }
      newState.easinessFactor = state.easinessFactor + 0.15
      break
    }
  }

  newState.nextReviewAt = new Date(Date.now() + newState.interval * 24 * 60 * 60 * 1000)

  return newState
}

/**
 * 다음 등장 시간을 사용자 친화 문자열로 변환
 */
export function formatNextReview(rating: SRSRating, state: SRSState): string {
  const next = calculateNextSRS(state, rating)
  const ms = next.nextReviewAt.getTime() - Date.now()
  const minutes = ms / (1000 * 60)
  const hours = minutes / 60
  const days = hours / 24

  if (minutes < 60) return `${Math.round(minutes)}분 후`
  if (hours < 24) return `${Math.round(hours)}시간 후`
  if (days < 2) return '내일'
  if (days < 30) return `${Math.round(days)}일 후`
  return `${Math.round(days / 30)}개월 후`
}

/**
 * SRS 큐 우선순위 정렬
 *  1. 밀린 카드 (nextReviewAt < now)
 *  2. 신규 카드 (repetitions === 0 && lapses === 0)
 *  3. 미래 카드 (학습 안 함)
 */
export function sortByPriority<T extends { srs: SRSState }>(cards: T[]): T[] {
  const now = Date.now()
  return [...cards].sort((a, b) => {
    const aOverdue = a.srs.nextReviewAt.getTime() < now
    const bOverdue = b.srs.nextReviewAt.getTime() < now

    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    // 둘 다 밀렸으면 더 오래 밀린 것 먼저
    if (aOverdue && bOverdue) {
      return a.srs.nextReviewAt.getTime() - b.srs.nextReviewAt.getTime()
    }

    // 신규 카드 우선
    const aNew = a.srs.repetitions === 0 && a.srs.lapses === 0
    const bNew = b.srs.repetitions === 0 && b.srs.lapses === 0
    if (aNew && !bNew) return -1
    if (!aNew && bNew) return 1

    return 0
  })
}
