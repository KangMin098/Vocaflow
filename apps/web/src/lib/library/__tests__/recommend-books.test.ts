// apps/web/src/lib/library/__tests__/recommend-books.test.ts
// 도서 추천 점수 + 장르 버킷 순수 함수 단위 테스트.

import { describe, it, expect } from 'vitest'

import { rankBooks, scoreBook } from '../recommend-books'
import { ageBandOf, bucketOf, lengthBucket, vBandOf } from '../genres'
import type { PublishedBook } from '../published-book'

function book(over: Partial<PublishedBook> & { id: string }): PublishedBook {
  return {
    title: over.id,
    author: null,
    cefr_level: null,
    cefr_band: null,
    book_v_level: 6,
    word_count: 1000,
    chapter_count: 5,
    reading_minutes: 120,
    ...over,
  }
}

// V5 학습자 기준 coverage[5] 로 tier 제어.
const cov = (pct: number): Record<string, number> => ({ '5': pct })

describe('recommend-books — scoreBook tier 정렬 (진단 V5)', () => {
  const ctx = { userVLevel: 5, userMastery: 'cold' as const }

  it('ideal > challenge > easy > hard 순서로 정렬된다', () => {
    const books = [
      book({ id: 'hard', lexical_coverage: cov(70) }),
      book({ id: 'easy', lexical_coverage: cov(99) }),
      book({ id: 'ideal', lexical_coverage: cov(96) }),
      book({ id: 'challenge', lexical_coverage: cov(90) }),
    ]
    const order = rankBooks(books, ctx).map((r) => r.book.id)
    expect(order).toEqual(['ideal', 'challenge', 'easy', 'hard'])
  })

  it('ideal 도서는 "딱 맞는 난이도" 사유를 갖는다', () => {
    const s = scoreBook(book({ id: 'x', lexical_coverage: cov(96) }), ctx)
    expect(s.reasons).toContain('딱 맞는 난이도')
  })

  it('완독 도서는 큰 감점으로 하향된다', () => {
    const fresh = scoreBook(book({ id: 'a', lexical_coverage: cov(96) }), ctx).score
    const done = scoreBook(
      book({ id: 'b', lexical_coverage: cov(96), enrollment_state: 'completed' }),
      ctx,
    ).score
    expect(done).toBeLessThan(fresh)
  })
})

describe('recommend-books — 미진단 fallback', () => {
  const ctx = { userVLevel: 0, userMastery: 'cold' as const }

  it('낮은 V-level 도서를 더 높게 평가한다', () => {
    const order = rankBooks(
      [book({ id: 'hi', book_v_level: 8 }), book({ id: 'lo', book_v_level: 2 })],
      ctx,
    ).map((r) => r.book.id)
    expect(order).toEqual(['lo', 'hi'])
  })

  it('i+1 사유는 미진단 시 노출되지 않는다', () => {
    const s = scoreBook(book({ id: 'x', lexical_coverage: cov(96) }), ctx)
    expect(s.reasons).not.toContain('딱 맞는 난이도')
  })
})

describe('recommend-books — 어포던스 사유', () => {
  it('원어민 음성 있으면 사유에 포함', () => {
    const s = scoreBook(
      book({ id: 'x', has_audio: true, lexical_coverage: { '5': 96 } }),
      { userVLevel: 5, userMastery: 'cold' },
    )
    // ideal 배지 + 음성 — 최대 2개 사유
    expect(s.reasons).toContain('원어민 음성')
  })
})

describe('genres — bucketOf', () => {
  it('구체 장르를 broad 버킷으로 매핑', () => {
    expect(bucketOf('추리 단편집')).toBe('mystery')
    expect(bucketOf('SF')).toBe('scifi_fantasy')
    expect(bucketOf('환상 동화')).toBe('children_ya') // 동화 우선
    expect(bucketOf('시집')).toBe('poetry_drama')
    expect(bucketOf('정치 철학')).toBe('essay_philosophy')
    expect(bucketOf('역사 모험')).toBe('adventure_history')
    expect(bucketOf('로맨스 소설')).toBe('romance')
  })

  it('미매칭/빈값은 문학·소설(literary) fallback', () => {
    expect(bucketOf('사회 소설')).toBe('literary')
    expect(bucketOf(null)).toBe('literary')
    expect(bucketOf(undefined)).toBe('literary')
  })
})

describe('genres — lengthBucket', () => {
  it('reading_minutes 경계', () => {
    expect(lengthBucket(45)).toBe('short')
    expect(lengthBucket(120)).toBe('medium')
    expect(lengthBucket(300)).toBe('long')
    expect(lengthBucket(0)).toBeNull()
    expect(lengthBucket(null)).toBeNull()
  })
})

describe('genres — vBandOf', () => {
  it('V-level 을 5밴드로 매핑', () => {
    expect(vBandOf(1)).toBe('intro')
    expect(vBandOf(2)).toBe('intro')
    expect(vBandOf(4)).toBe('beginner')
    expect(vBandOf(6)).toBe('intermediate')
    expect(vBandOf(8)).toBe('upper')
    expect(vBandOf(11)).toBe('advanced')
    expect(vBandOf(null)).toBeNull()
  })
})

describe('genres — ageBandOf', () => {
  it('age_band 문자열을 3밴드로 매핑', () => {
    expect(ageBandOf('5+')).toBe('children')
    expect(ageBandOf('9+')).toBe('children')
    expect(ageBandOf('10+')).toBe('teen')
    expect(ageBandOf('15+')).toBe('teen')
    expect(ageBandOf('16+')).toBe('adult')
    expect(ageBandOf('17+')).toBe('adult')
    expect(ageBandOf(null)).toBeNull()
  })
})
