// apps/web/src/lib/scriptquiz/__tests__/queue-paging.test.ts
//
// ScriptQuiz 대기열의 **조용한 오답** 두 가지를 막는다.
//   ① `texts`/`scores` 가 1,000행에서 잘리면 → 읽은 챕터가 "안 읽음", 푼 챕터가 "안 풂" 이 된다.
//   ② 조회가 실패해 data=null 이면 → 같은 결과가 되고, 아무도 오류를 못 본다.
// 둘 다 오류 없이 화면만 틀리므로, 화면을 보고는 절대 발견할 수 없다.

import { describe, expect, it, vi } from 'vitest'

import { fetchScriptQuizQueue } from '../queue'

vi.mock('server-only', () => ({}))

const BOOK = '11111111-1111-1111-1111-111111111111'

vi.mock('../questions', () => ({
  fetchChapterQuizCatalog: async () => [
    {
      bookId: BOOK,
      bookTitle: 'Fables',
      bookVLevel: 5,
      chapters: Array.from({ length: 1200 }, (_, i) => ({
        chapterIdx: i + 1,
        chapterTitle: `Chapter ${i + 1}`,
        questionCount: 5,
      })),
      questionTotal: 6000,
    },
  ],
}))

/** `.range(from,to)` 를 실제로 존중하는 가짜 클라이언트 — 자르지 않는다. */
function clientWith(texts: unknown[], scores: unknown[], opts: { failScores?: boolean } = {}) {
  const build = (rows: unknown[], fail: boolean) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in']) b[m] = () => b
    b.range = (from: number, to: number) =>
      Promise.resolve(
        fail
          ? { data: null, error: { message: 'boom' } }
          : { data: rows.slice(from, to + 1), error: null },
      )
    return b
  }
  return {
    from: (table: string) =>
      table === 'texts' ? build(texts, false) : build(scores, opts.failScores ?? false),
  } as never
}

const READ_AT = '2026-08-01T00:00:00Z'

describe('fetchScriptQuizQueue — 행 상한과 실패', () => {
  it('읽은 챕터가 1,000행을 넘어도 전부 대기열에 남는다', async () => {
    const texts = Array.from({ length: 1200 }, (_, i) => ({
      library_book_id: BOOK,
      chapter_idx: i + 1,
      status: 'extracted',
      updated_at: READ_AT,
    }))
    const queue = await fetchScriptQuizQueue(clientWith(texts, []), 'u1')
    // 1,000 에서 잘렸다면 200개가 "안 읽음" 으로 사라지고 unreadHidden 이 200 이 된다.
    expect(queue.readTotal).toBe(1200)
    expect(queue.books[0].unreadHidden).toBe(0)
    expect(queue.unconfirmed).toBe(1200)
  })

  it('푼 기록이 1,000행을 넘어도 "확인함" 으로 세어진다', async () => {
    const texts = Array.from({ length: 1200 }, (_, i) => ({
      library_book_id: BOOK,
      chapter_idx: i + 1,
      status: 'completed',
      updated_at: READ_AT,
    }))
    const scores = Array.from({ length: 1200 }, (_, i) => ({
      content_id: BOOK,
      content_chapter: i + 1,
      accuracy: 80,
      created_at: '2026-08-02T00:00:00Z',
    }))
    const queue = await fetchScriptQuizQueue(clientWith(texts, scores), 'u1')
    expect(queue.books[0].confirmed).toBe(1200)
    // 전부 확인했으므로 "다음 한 걸음" 은 없다 — 잘렸다면 200개가 미확인으로 남는다.
    expect(queue.unconfirmed).toBe(0)
    expect(queue.next).toBeNull()
  })

  it('조회가 실패하면 빈 대기열이 아니라 예외를 던진다', async () => {
    const texts = [
      { library_book_id: BOOK, chapter_idx: 1, status: 'extracted', updated_at: READ_AT },
    ]
    await expect(
      fetchScriptQuizQueue(clientWith(texts, [], { failScores: true }), 'u1'),
    ).rejects.toThrow(/scores/)
  })
})
