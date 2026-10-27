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
  it('도서만 진입(세트 필터 없음): 장 번호가 있으면 그 번호, 없으면 첫 장 — 기존 동작', () => {
    expect(resolveBookChapter(null, '2', CH)).toBe(2)
    expect(resolveBookChapter('all', undefined, CH)).toBe(1)
    expect(resolveBookChapter('text:abc', undefined, [])).toBe(0)
  })
  it('미존재 장 번호(도서만 진입)는 그 번호로 — 세트 안내는 isCurrent 일치가 없어 표시되지 않는다', () => {
    expect(resolveBookChapter(null, '7', CH)).toBe(7)
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
