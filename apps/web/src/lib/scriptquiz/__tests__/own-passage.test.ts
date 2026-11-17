// apps/web/src/lib/scriptquiz/__tests__/own-passage.test.ts
import { describe, expect, it, vi } from 'vitest'
import { parseQuizScope, quizPageMode, readOwnPassage, type OwnPassageDeps } from '../own-passage'

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

describe('parseQuizScope — 범위 있음과 유효함을 나눈다 (R03)', () => {
  const B = '11111111-1111-4111-8111-111111111111'
  const T = '22222222-2222-4222-8222-222222222222'
  it('범위 없음 → none(데모)', () => {
    expect(parseQuizScope({})).toEqual({ kind: 'none' })
  })
  it('정상 book·ch·text / book·ch / text', () => {
    expect(parseQuizScope({ book: B, ch: '3', text: T })).toEqual({ kind: 'book', bookId: B, chapterIdx: 3, textId: T })
    expect(parseQuizScope({ book: B, ch: '0' })).toEqual({ kind: 'book', bookId: B, chapterIdx: 0 })
    expect(parseQuizScope({ text: T })).toEqual({ kind: 'text', textId: T })
  })
  it('book 만 · book+bad ch · ch 만 → invalid (데모로 바꾸지 않는다)', () => {
    expect(parseQuizScope({ book: B })).toEqual({ kind: 'invalid' })
    expect(parseQuizScope({ book: B, ch: 'bad' })).toEqual({ kind: 'invalid' })
    expect(parseQuizScope({ book: B, ch: '' })).toEqual({ kind: 'invalid' })
    expect(parseQuizScope({ ch: '1' })).toEqual({ kind: 'invalid' })
  })
  it('ch=1junk · 1.5 · -1 · 01 · 거대수 → invalid (1로 절삭하지 않는다)', () => {
    for (const ch of ['1junk', '1.5', '-1', '01', ' 1', '1e2', '99999999999999999999']) {
      expect(parseQuizScope({ book: B, ch })).toEqual({ kind: 'invalid' })
    }
  })
  it('uuid 가 아닌 book·text → invalid', () => {
    expect(parseQuizScope({ book: 'nope', ch: '1' })).toEqual({ kind: 'invalid' })
    expect(parseQuizScope({ text: 'nope' })).toEqual({ kind: 'invalid' })
    expect(parseQuizScope({ book: B, ch: '1', text: 'nope' })).toEqual({ kind: 'invalid' })
  })
  it('invalid 는 문항이 없으므로 빈 상태', () => {
    expect(quizPageMode(true, false)).toBe('empty')
  })
})
