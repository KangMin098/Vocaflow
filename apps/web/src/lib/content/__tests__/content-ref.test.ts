// apps/web/src/lib/content/__tests__/content-ref.test.ts
//
// content_ref 는 "어떤 자료로 학습했나" 의 유일한 근거다. 여기가 틀리면 증상이 **조용하다** —
// 세션은 정상 적재되고 화면도 멀쩡한데 집계에서만 빠진다(그게 49행 전부 NULL 이었던 방식이다).
// 그래서 DB CHECK 와 같은 규칙을 코드 쪽에서도 고정한다.

import { describe, it, expect } from 'vitest'

import {
  contentRefFromBook,
  contentRefFromScope,
  contentRefFromText,
  isValidContentRef,
  toScoreColumns,
} from '../content-ref'

const UUID = '6e8b3442-1404-4172-865b-3dcd6c5848d9'
const UUID2 = '89970bfa-f49d-44c2-92ce-75895a608317'

describe('isValidContentRef — DB CHECK 와 같은 규칙', () => {
  it("'mine' 은 id 가 없어야 성립한다", () => {
    expect(isValidContentRef({ type: 'mine' })).toBe(true)
    expect(isValidContentRef({ type: 'mine', id: UUID })).toBe(false)
  })

  it('나머지 유형은 uuid 가 있어야 한다', () => {
    expect(isValidContentRef({ type: 'book', id: UUID })).toBe(true)
    expect(isValidContentRef({ type: 'set' })).toBe(false)
    // 세션 키('vocab'·'script'·'all')가 잘못 흘러들어오는 경로가 실제로 있었다 — uuid 만 통과시킨다
    expect(isValidContentRef({ type: 'text', id: 'script' })).toBe(false)
  })

  it('null/undefined 는 참조가 아니다', () => {
    expect(isValidContentRef(null)).toBe(false)
    expect(isValidContentRef(undefined)).toBe(false)
  })
})

describe('toScoreColumns', () => {
  it('형태가 어긋나면 전부 null — 적재 자체는 막지 않는다', () => {
    // CHECK 위반으로 세션 기록을 통째로 잃는 것보다 자료 미상으로 남기는 편이 낫다
    expect(toScoreColumns({ type: 'book' })).toEqual({
      content_type: null,
      content_id: null,
      content_chapter: null,
    })
    expect(toScoreColumns(null)).toEqual({
      content_type: null,
      content_id: null,
      content_chapter: null,
    })
  })

  it('book 은 챕터를 싣는다', () => {
    expect(toScoreColumns({ type: 'book', id: UUID, chapter: 3 })).toEqual({
      content_type: 'book',
      content_id: UUID,
      content_chapter: 3,
    })
  })

  it('book 이 아닌 유형의 챕터는 버린다 — 잘못된 필터의 원인이 된다', () => {
    expect(toScoreColumns({ type: 'set', id: UUID, chapter: 3 })).toEqual({
      content_type: 'set',
      content_id: UUID,
      content_chapter: null,
    })
  })

  it("'mine' 은 id 없이 유효하다", () => {
    expect(toScoreColumns({ type: 'mine' })).toEqual({
      content_type: 'mine',
      content_id: null,
      content_chapter: null,
    })
  })
})

describe('contentRefFromScope — ?set= / ?text= / 없음', () => {
  it('set 이 우선한다', () => {
    expect(contentRefFromScope({ set: UUID, text: UUID2 })).toEqual({ type: 'set', id: UUID })
  })

  it('text 만 있으면 스크립트', () => {
    expect(contentRefFromScope({ text: UUID2 })).toEqual({ type: 'text', id: UUID2 })
  })

  it('스코프가 없으면 내 복습 큐', () => {
    expect(contentRefFromScope({})).toEqual({ type: 'mine' })
  })

  it('book 은 챕터와 함께 온다 (enroll 없이 큐레이션 챕터로 논다)', () => {
    expect(contentRefFromScope({ book: UUID, chapter: 2 })).toEqual({
      type: 'book',
      id: UUID,
      chapter: 2,
    })
    // 챕터를 안 주면 도서 전체 — 해석기가 첫 챕터를 고른다
    expect(contentRefFromScope({ book: UUID })).toEqual({ type: 'book', id: UUID })
  })

  it('좁은 스코프가 넓은 것을 이긴다 (set > text > book)', () => {
    // set 은 이미 한 챕터로 좁혀진 자료다 — book 이 같이 와도 set 을 쓴다
    expect(contentRefFromScope({ set: UUID, book: UUID2 })).toEqual({ type: 'set', id: UUID })
    expect(contentRefFromScope({ text: UUID, book: UUID2 })).toEqual({ type: 'text', id: UUID })
  })
})

describe('contentRefFromText — enroll 한 도서 챕터는 도서로 접힌다', () => {
  it('library_book_id 가 있으면 book 으로 귀속한다', () => {
    // 챕터별로 text 로 남기면 "이 도서로 얼마나 했나" 가 챕터 수만큼 흩어진다
    expect(
      contentRefFromText({ id: UUID2, library_book_id: UUID, chapter_idx: 4 }),
    ).toEqual({ type: 'book', id: UUID, chapter: 4 })
  })

  it('내 스크립트는 text 그대로', () => {
    expect(contentRefFromText({ id: UUID2, library_book_id: null, chapter_idx: null })).toEqual({
      type: 'text',
      id: UUID2,
    })
  })
})

describe('contentRefFromBook', () => {
  it('챕터가 없으면 도서 전체', () => {
    expect(contentRefFromBook(UUID, null)).toEqual({ type: 'book', id: UUID })
  })
})
