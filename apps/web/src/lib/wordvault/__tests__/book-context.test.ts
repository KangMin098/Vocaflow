// apps/web/src/lib/wordvault/__tests__/book-context.test.ts
import { describe, expect, it } from 'vitest'
import { parseChapterParam, resolveBookChapter } from '../book-context'

const CH = [
  { id: 'set-a1', chapterIdx: 1 },
  { id: 'set-a2', chapterIdx: 2 },
]

describe('resolveBookChapter — 보이는 단어의 출처와 안내가 같을 때만', () => {
  it('정상: 이 도서의 장 세트 + 같은 장 번호(또는 생략) → 그 장', () => {
    expect(resolveBookChapter('set:set-a1', '1', CH)).toBe(1)
    expect(resolveBookChapter('set:set-a2', undefined, CH)).toBe(2)
  })
  it('다른 도서의 세트 B 를 도서 A 와 함께 열면 안내 없음', () => {
    expect(resolveBookChapter('set:set-b9', '1', CH)).toBeNull()
  })
  it('같은 도서 다른 장: 세트는 2장인데 chapter=1 → 안내 없음', () => {
    expect(resolveBookChapter('set:set-a2', '1', CH)).toBeNull()
  })
  it('장 번호 형식 오류는 절삭하지 않고 안내 없음', () => {
    for (const ch of ['1junk', '1.5', '-1', '01', ' 1', '1e1', '99999999999999999999']) {
      expect(resolveBookChapter('set:set-a1', ch, CH)).toBeNull()
      expect(resolveBookChapter(null, ch, CH)).toBeNull()
    }
  })
  it('세트가 아닌 필터(text:·state:·all·없음)는 장 안내를 만들지 않는다', () => {
    for (const f of ['text:글B', 'state:new', 'all', null, undefined]) {
      expect(resolveBookChapter(f, '1', CH)).toBeNull()
      expect(resolveBookChapter(f, undefined, CH)).toBeNull()
    }
  })
  it('없는 장 번호는 그 세트와 안 맞으니 안내 없음', () => {
    expect(resolveBookChapter('set:set-a1', '999', CH)).toBeNull()
    expect(resolveBookChapter(undefined, '999', CH)).toBeNull()
  })
})

describe('반복 파라미터(배열)', () => {
  it('filter·chapter 가 배열이면 안내 없음(500 아님)', () => {
    expect(resolveBookChapter(['set:set-a1', 'set:set-a2'], '1', CH)).toBeNull()
    expect(resolveBookChapter('set:set-a1', ['1', '2'], CH)).toBeNull()
  })
})

describe('parseChapterParam', () => {
  it('없음 → undefined · 정수 → 숫자 · 형식 오류 → null', () => {
    expect(parseChapterParam(undefined)).toBeUndefined()
    expect(parseChapterParam('')).toBeUndefined()
    expect(parseChapterParam('0')).toBe(0)
    expect(parseChapterParam('12')).toBe(12)
    expect(parseChapterParam('1junk')).toBeNull()
  })
})
