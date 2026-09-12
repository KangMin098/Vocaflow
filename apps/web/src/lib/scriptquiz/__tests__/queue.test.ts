// apps/web/src/lib/scriptquiz/__tests__/queue.test.ts
//
// 이 화면의 계약은 두 줄이다:
//   ① **읽지 않은 챕터는 절대 내주지 않는다** — 독해 퀴즈는 줄거리를 담고 있어서
//      안 읽은 챕터에 내주는 순간 스포일러가 된다. 실제로 그렇게 배포돼 있었다
//      (Pride and Prejudice 61챕터 중 학습자가 읽은 것은 19개뿐인데 61개를 전부 팔았다).
//   ② 다음 한 걸음은 **읽은 지 가장 오래된 미확인 챕터** — 간격 인출(Roediger & Karpicke:
//      즉시·집중 인출은 효과가 작고 간격을 둔 인출이 강하다).
// 규칙이 조용히 뒤집혀도 화면은 멀쩡해 보이므로 여기서 못 박는다.

import { describe, expect, it } from 'vitest'

import { buildQuizQueue } from '../queue'
import type { ChapterQuizCatalogBook } from '@/components/game/scriptquiz/types'

const BOOK = 'book-1'

function catalog(chapterCount: number): ChapterQuizCatalogBook[] {
  return [
    {
      bookId: BOOK,
      bookTitle: 'Pride and Prejudice',
      bookVLevel: 8,
      chapters: Array.from({ length: chapterCount }, (_, i) => ({
        chapterIdx: i + 1,
        chapterTitle: `Chapter ${i + 1}`,
        questionCount: 8,
      })),
      questionTotal: chapterCount * 8,
    },
  ]
}

/** ch1..readThrough 를 읽음으로, 나머지는 미열람으로 만든다. */
function texts(readThrough: number, total: number, at = '2026-08-01T00:00:00Z') {
  return Array.from({ length: total }, (_, i) => ({
    library_book_id: BOOK,
    chapter_idx: i + 1,
    status: i < readThrough ? 'extracted' : 'not_started',
    updated_at: at,
  }))
}

describe('ScriptQuiz 대기열', () => {
  it('읽지 않은 챕터는 목록에 들어가지 않는다 (스포일러 차단)', () => {
    const q = buildQuizQueue(catalog(61), texts(19, 61), [])
    const book = q.books[0]!
    expect(book.readChapters).toHaveLength(19)
    expect(book.readChapters.every((c) => c.chapterIdx <= 19)).toBe(true)
    // 숨긴 것을 숨기지 않는다 — 몇 개를 뺐는지는 말한다
    expect(book.unreadHidden).toBe(42)
    // 다음 한 걸음도 반드시 읽은 범위 안
    expect(q.next!.chapter.chapterIdx).toBeLessThanOrEqual(19)
  })

  it('in_progress·not_started 는 읽은 것이 아니다 (v_user_book_progress 와 같은 집합)', () => {
    const rows = [
      { library_book_id: BOOK, chapter_idx: 1, status: 'completed', updated_at: '2026-08-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 2, status: 'conquered', updated_at: '2026-08-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 3, status: 'extracted', updated_at: '2026-08-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 4, status: 'in_progress', updated_at: '2026-08-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 5, status: 'not_started', updated_at: '2026-08-01T00:00:00Z' },
    ]
    const q = buildQuizQueue(catalog(5), rows, [])
    expect(q.books[0]!.readChapters.map((c) => c.chapterIdx)).toEqual([1, 2, 3])
  })

  it('다음 한 걸음은 읽은 지 가장 오래된 미확인 챕터다 (간격 인출)', () => {
    const rows = [
      { library_book_id: BOOK, chapter_idx: 1, status: 'extracted', updated_at: '2026-08-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 2, status: 'extracted', updated_at: '2026-07-01T00:00:00Z' }, // 가장 오래됨
      { library_book_id: BOOK, chapter_idx: 3, status: 'extracted', updated_at: '2026-08-10T00:00:00Z' },
    ]
    const q = buildQuizQueue(catalog(3), rows, [])
    expect(q.next!.chapter.chapterIdx).toBe(2)
  })

  it('이미 확인한 챕터는 다음 한 걸음이 되지 않는다', () => {
    const rows = [
      { library_book_id: BOOK, chapter_idx: 1, status: 'extracted', updated_at: '2026-07-01T00:00:00Z' },
      { library_book_id: BOOK, chapter_idx: 2, status: 'extracted', updated_at: '2026-08-01T00:00:00Z' },
    ]
    const scores = [
      { content_id: BOOK, content_chapter: 1, accuracy: 75, created_at: '2026-08-05T00:00:00Z' },
    ]
    const q = buildQuizQueue(catalog(2), rows, scores)
    expect(q.next!.chapter.chapterIdx).toBe(2)
    expect(q.unconfirmed).toBe(1)
    expect(q.books[0]!.confirmed).toBe(1)
    // 확인한 챕터도 목록에는 남는다 — 다시 풀 수 있어야 한다(막지 않는다)
    expect(q.books[0]!.readChapters).toHaveLength(2)
  })

  it('여러 번 푼 챕터는 마지막 시도를 쓴다', () => {
    const rows = [
      { library_book_id: BOOK, chapter_idx: 1, status: 'extracted', updated_at: '2026-07-01T00:00:00Z' },
    ]
    const scores = [
      { content_id: BOOK, content_chapter: 1, accuracy: 20, created_at: '2026-08-01T00:00:00Z' },
      { content_id: BOOK, content_chapter: 1, accuracy: 90, created_at: '2026-08-09T00:00:00Z' },
      { content_id: BOOK, content_chapter: 1, accuracy: 50, created_at: '2026-08-05T00:00:00Z' },
    ]
    const q = buildQuizQueue(catalog(1), rows, scores)
    expect(q.books[0]!.readChapters[0]!.lastAccuracy).toBe(90)
  })

  it('한 챕터도 안 읽은 책은 아예 나오지 않는다', () => {
    const q = buildQuizQueue(catalog(10), texts(0, 10), [])
    expect(q.books).toHaveLength(0)
    expect(q.next).toBeNull()
    expect(q.readTotal).toBe(0)
  })

  it('다 확인했으면 다음 한 걸음이 없다 (빈 화면이 아니라 "다 했어요" 상태)', () => {
    const rows = texts(2, 2)
    const scores = [
      { content_id: BOOK, content_chapter: 1, accuracy: 80, created_at: '2026-08-05T00:00:00Z' },
      { content_id: BOOK, content_chapter: 2, accuracy: 80, created_at: '2026-08-06T00:00:00Z' },
    ]
    const q = buildQuizQueue(catalog(2), rows, scores)
    expect(q.next).toBeNull()
    expect(q.unconfirmed).toBe(0)
    expect(q.readTotal).toBe(2)
  })

  it('다음에 읽을 챕터는 읽지 않은 것 중 가장 앞선 것 (이야기 순서)', () => {
    const q = buildQuizQueue(catalog(10), texts(3, 10), [])
    expect(q.books[0]!.nextToRead?.chapterIdx).toBe(4)
  })
})
