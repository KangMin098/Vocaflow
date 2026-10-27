// apps/web/src/lib/scriptquiz/__tests__/own-passage.test.ts
import { describe, expect, it, vi } from 'vitest'
import { quizPageMode, readOwnPassage, type OwnPassageDeps } from '../own-passage'

const ME = 'user-me'
const BOOK = { bookId: 'book-1', chapterIdx: 3 }

function deps(over: Partial<OwnPassageDeps> = {}): OwnPassageDeps {
  return {
    currentUserId: async () => ME,
    // RLS·조회 조건과 같게 — 내 행만 돌아온다
    findOwnText: async (textId, userId) =>
      userId === ME && textId === 'mine' ? { library_book_id: 'book-1', chapter_idx: 3 } : null,
    readContent: async () => 'Body text here.',
    ...over,
  }
}

describe('readOwnPassage', () => {
  it('본인 글 · 같은 도서·챕터면 본문', async () => {
    expect(await readOwnPassage(deps(), 'mine', BOOK)).toBe('Body text here.')
    expect(await readOwnPassage(deps(), 'mine', null)).toBe('Body text here.')
  })
  it('타인 글·없는 글은 본문을 읽지 않는다', async () => {
    const readContent = vi.fn(async () => 'leak')
    expect(await readOwnPassage(deps({ readContent }), 'someone-else', BOOK)).toBeUndefined()
    expect(await readOwnPassage(deps({ readContent }), '', BOOK)).toBeUndefined()
    expect(readContent).not.toHaveBeenCalled()
  })
  it('본인 글이라도 다른 도서·챕터면 본문을 넘기지 않는다', async () => {
    const readContent = vi.fn(async () => 'other chapter')
    expect(await readOwnPassage(deps({ readContent }), 'mine', { bookId: 'book-1', chapterIdx: 4 })).toBeUndefined()
    expect(await readOwnPassage(deps({ readContent }), 'mine', { bookId: 'book-2', chapterIdx: 3 })).toBeUndefined()
    expect(readContent).not.toHaveBeenCalled()
  })
  it('미인증이면 undefined', async () => {
    expect(await readOwnPassage(deps({ currentUserId: async () => null }), 'mine', BOOK)).toBeUndefined()
  })
  it('본문 null·공백·RPC 실패·조회 실패는 undefined(퀴즈는 계속)', async () => {
    expect(await readOwnPassage(deps({ readContent: async () => null }), 'mine', BOOK)).toBeUndefined()
    expect(await readOwnPassage(deps({ readContent: async () => '   ' }), 'mine', BOOK)).toBeUndefined()
    expect(await readOwnPassage(deps({ readContent: async () => { throw new Error('rpc') } }), 'mine', BOOK)).toBeUndefined()
    expect(await readOwnPassage(deps({ findOwnText: async () => { throw new Error('db') } }), 'mine', BOOK)).toBeUndefined()
  })
})

describe('quizPageMode', () => {
  it('범위 지정 + 문항 0 → 빈 상태(데모로 바꾸지 않음) · 범위 없음 → 데모 · 문항 있음 → 퀴즈', () => {
    expect(quizPageMode(true, false)).toBe('empty')
    expect(quizPageMode(false, false)).toBe('demo')
    expect(quizPageMode(true, true)).toBe('quiz')
    expect(quizPageMode(false, true)).toBe('quiz')
  })
})
