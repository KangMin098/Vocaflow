// apps/web/src/lib/srs/__tests__/stability-growth.test.ts
//
// **복습을 거듭하면 stability 가 자라는가.**
//
// 이 저장소의 학습 모델 전체가 여기에 매달려 있다 — 간격 반복(원칙 ②)도, Memory Decay
// 4색(R(t) = 0.9^(t/S))도, `/dashboard` 의 지속 사다리도 S 가 자란다는 전제 위에 있다.
// S 가 안 자라면 오류는 하나도 안 나면서 **제품의 핵심 알고리즘만 조용히 멈춘다.**
//
// 실측 2026-09-05 — 실제로 멈춰 있었다. `toFsrsCard` 가 `createEmptyCard()` 위에
// D/S/last_review 만 덮고 `state` 를 안 넣어, 카드가 영원히 `State.New` 였다.
// ts-fsrs 는 New 분기에서 복원한 S 를 **버리고** `S = w[rating-1]` 로 초기화한다.
//   Good 8회: 2.3065 → 2.3065 → … (전부 동일 · FSRS-5 초기값 w[2] 그대로)
//   DB 실측: 복습한 234단어의 최대 stability 8.2956일, 그리고 복습 횟수와 **역상관**
//            (29회 복습한 단어의 S = 0.0010일 = 86초)
// 결과로 `stable`(R≥0.95)은 구조적으로 도달 불가였고 — 실측 stable 0 / shaky 0 / risk 234 —
// `known_word_count` 의 임계 `stability >= 21` 도 영원히 넘지 못했다(실측 두 계정 다 0).
//
// 기존 `srs.test.ts` 가 왜 못 잡았나 — 관련 단언이 `Again.stability <= Hard.stability`
// 하나뿐이었다. 둘 다 초기화되므로 **버그가 있어도 통과한다.** 성장을 단언해야 잡힌다.

import { describe, expect, it } from 'vitest'

import { applyReview, createNewCard } from '../fsrs'
import { Rating } from '../types'
import type { SrsCard } from '../types'

const DAY = 24 * 60 * 60 * 1000

/** 예정일에 정확히 맞춰 n회 복습한다 — 실제 학습자가 하는 가장 좋은 경우 */
function reviewSeries(rating: (typeof Rating)[keyof typeof Rating], times: number) {
  let card: SrsCard = createNewCard('w1')
  let at = new Date('2026-01-01T00:00:00Z')
  const stabilities: number[] = []
  for (let i = 0; i < times; i += 1) {
    const r = applyReview({ card, rating, module: 'flashcard', reviewedAt: at })
    card = r.card
    stabilities.push(Number(card.stability.toFixed(4)))
    at = card.nextReviewAt ?? new Date(at.getTime() + DAY)
  }
  return { card, stabilities }
}

describe('FSRS — 복습을 거듭하면 기억이 오래간다', () => {
  it('good 을 8회 반복하면 stability 가 단조 증가한다', () => {
    const { stabilities } = reviewSeries(Rating.Good, 8)
    for (let i = 1; i < stabilities.length; i += 1) {
      expect(stabilities[i]).toBeGreaterThan(stabilities[i - 1]!)
    }
  })

  it('good 8회 뒤 stability 가 첫 복습의 3배를 넘는다 — 자라기는 하나가 아니라 크게 자란다', () => {
    const { stabilities } = reviewSeries(Rating.Good, 8)
    expect(stabilities[7]!).toBeGreaterThan(stabilities[0]! * 3)
  })

  it('easy 를 반복해도 자란다 (초기값에 고정되지 않는다)', () => {
    const { stabilities } = reviewSeries(Rating.Easy, 5)
    expect(stabilities[4]!).toBeGreaterThan(stabilities[0]!)
  })

  it('복습을 많이 할수록 간격이 넓어진다', () => {
    let card = createNewCard('w2')
    let at = new Date('2026-01-01T00:00:00Z')
    const gaps: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const r = applyReview({ card, rating: Rating.Good, module: 'flashcard', reviewedAt: at })
      card = r.card
      gaps.push((card.nextReviewAt!.getTime() - at.getTime()) / DAY)
      at = card.nextReviewAt!
    }
    expect(gaps[5]!).toBeGreaterThan(gaps[0]!)
  })

  it('꾸준히 맞히면 stability 가 21일(known_word_count 임계)을 넘을 수 있다', () => {
    const { stabilities } = reviewSeries(Rating.Good, 12)
    expect(Math.max(...stabilities)).toBeGreaterThan(21)
  })

  it('again 은 stability 를 떨어뜨린다 — 성장만 하는 것도 틀렸다', () => {
    let card = createNewCard('w3')
    let at = new Date('2026-01-01T00:00:00Z')
    for (let i = 0; i < 5; i += 1) {
      card = applyReview({ card, rating: Rating.Good, module: 'flashcard', reviewedAt: at }).card
      at = card.nextReviewAt!
    }
    const grown = card.stability
    const lapsed = applyReview({ card, rating: Rating.Again, module: 'flashcard', reviewedAt: at }).card
    expect(lapsed.stability).toBeLessThan(grown)
  })
})
