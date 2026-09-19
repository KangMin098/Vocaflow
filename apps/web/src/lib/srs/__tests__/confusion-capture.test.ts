// apps/web/src/lib/srs/__tests__/confusion-capture.test.ts
//
// 오답일 때 **무엇과 헷갈렸는지**를 기록에 남기는 경로.
//
// 왜 이 스펙이 필요한가:
//   `learning_records` 는 331건의 오답을 갖고 있지만 그중 "그때 무엇을 골랐나" 는 0건이었다.
//   WordBlitz 는 고른 보기를 손에 쥐고 있었고(같은 함수 안에서 `isNearMiss` 에 쓴다)
//   `onWrong` 을 부를 때 그것을 버렸다. 그래서 컴포저의 `confusion-log` 유형은
//   "내가 헷갈린 짝" 을 약속하면서 짝을 만들 재료가 없었다.
//
//   이 값이 다시 조용히 사라지면 그 유형은 영원히 활성화되지 않는다 — 아무 화면도
//   빨개지지 않으므로 알아챌 방법이 없다. 그래서 payload 층에서 계약을 고정한다.

import { describe, expect, it } from 'vitest'
import { resultToRecordPayload } from '../supabase-adapter'
import type { ReviewResult } from '../types'

/** applyReview 결과 중 payload 가 읽는 부분만 만든다 (FSRS 카드 필드는 이 스펙과 무관). */
function reviewResult(rating: number): ReviewResult {
  return {
    log: {
      cardId: '11111111-1111-4111-8111-111111111111',
      module: 'wordblitz',
      rating,
      reviewedAt: new Date('2026-08-15T00:00:00.000Z'),
    },
  } as unknown as ReviewResult
}

const AGAIN = 1
const GOOD = 3
const USER = '22222222-2222-4222-8222-222222222222'

describe('오답 시 고른 단어 기록 (learning_records.metadata.chosen)', () => {
  it('오답 + 고른 단어 → metadata.chosen 에 남는다', () => {
    const p = resultToRecordPayload(reviewResult(AGAIN), USER, 'site')
    expect(p.is_correct).toBe(false)
    expect(p.metadata).toEqual({ chosen: 'site' })
  })

  it('정답이면 고른 단어를 담지 않는다 — 정답의 chosen 은 자기 자신이다', () => {
    // 담으면 짝 집계에서 "cite ↔ cite" 가 절반을 차지한다.
    const p = resultToRecordPayload(reviewResult(GOOD), USER, 'cite')
    expect(p.is_correct).toBe(true)
    expect(p.metadata).toBeUndefined()
  })

  it('시간 초과처럼 고른 것이 없으면 키 자체가 없다', () => {
    // `{}` 로 남기면 "선택지가 없었다" 와 "골랐는데 기록을 놓쳤다" 가 구별되지 않는다.
    expect(resultToRecordPayload(reviewResult(AGAIN), USER).metadata).toBeUndefined()
    expect(resultToRecordPayload(reviewResult(AGAIN), USER, '   ').metadata).toBeUndefined()
  })

  it('앞뒤 공백은 정리해 담는다 — 짝 키가 공백 때문에 갈리면 안 된다', () => {
    expect(resultToRecordPayload(reviewResult(AGAIN), USER, ' site ').metadata).toEqual({
      chosen: 'site',
    })
  })
})
