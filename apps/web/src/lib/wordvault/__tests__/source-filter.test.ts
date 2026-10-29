// apps/web/src/lib/wordvault/__tests__/source-filter.test.ts
// Reader 가 만든 「단어」 URL → Browse 가 읽는 필터 → 실제 목록. 문자열 모양이 아니라 왕복 결과를 본다.
import { describe, expect, it } from 'vitest'
import { applySourceFilter, normalizeSourceFilter, readerScopeQuery, readerWordsHref } from '../source-filter'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const SET = '33333333-3333-4333-8333-333333333333'
const words = [
  { id: 1, word: 'apple', textId: A, setId: null },
  { id: 2, word: 'brick', textId: A, setId: null },
  { id: 3, word: 'cloud', textId: B, setId: null },
  { id: 4, word: 'delta', textId: null, setId: SET },
]

/** Browse 와 같은 순서로 읽는다: URL → filter 파라미터 → 정규화 → 출처 필터 */
function browse(href: string, list = words) {
  const filter = normalizeSourceFilter(new URL(href, 'http://x').searchParams.get('filter'))
  return { filter, ids: applySourceFilter(list, filter).map((w) => w.id) }
}

describe('Reader → WordVault 출처 범위 왕복', () => {
  it('개인 글·단어장 없는 챕터: 글 A 에서 만든 URL 은 A 의 단어만 보인다(B 섞이지 않음)', () => {
    const href = readerWordsHref({ textId: A })
    expect(browse(href)).toEqual({ filter: `text:${A}`, ids: [1, 2] })
    expect(browse(readerWordsHref({ textId: A, libraryBookId: 'book', chapterIdx: 2, currentChapterWordSet: null })).ids).toEqual([1, 2])
  })
  it('그 글 단어가 0 이면 빈 목록 — 다른 글 단어로 대신 채우지 않는다', () => {
    expect(browse(readerWordsHref({ textId: A }), words.filter((w) => w.textId !== A)).ids).toEqual([])
  })
  it('발행 챕터 단어장이 있으면 예전대로 set: 범위(도서·챕터 동반)', () => {
    const href = readerWordsHref({ textId: A, libraryBookId: 'book-1', chapterIdx: 3, currentChapterWordSet: { id: SET } })
    const u = new URL(href, 'http://x')
    expect(u.searchParams.get('book')).toBe('book-1')
    expect(u.searchParams.get('chapter')).toBe('3')
    expect(browse(href).ids).toEqual([4])
  })
  it('맥락이 없으면 전체', () => {
    expect(readerWordsHref(null)).toBe('/wordvault/browse')
    expect(browse('/wordvault/browse').ids).toEqual([1, 2, 3, 4])
  })
  it('예전 링크(접두어 없는 uuid)도 그 글 범위로 읽는다 — 전체로 흘리지 않는다', () => {
    expect(browse(`/wordvault/browse?filter=${A}`)).toEqual({ filter: `text:${A}`, ids: [1, 2] })
  })
  it('state:·all·uuid 아닌 값은 출처 필터를 걸지 않는다(기존 의미 유지)', () => {
    expect(normalizeSourceFilter('state:new')).toBe('state:new')
    expect(normalizeSourceFilter('all')).toBe('all')
    expect(normalizeSourceFilter('')).toBe('all')
    expect(normalizeSourceFilter('not-a-uuid')).toBe('not-a-uuid')
  })
})

describe('기사 단어장 — 이미 받은 발행 기사 세트로(도서로 꾸미지 않음)', () => {
  const ASET = '8d96bad7-d7ec-4432-a0ba-aa89ca4a0997'
  const ARTICLE_TEXT = '44444444-4444-4444-8444-444444444444'
  // 기사 단어장 구독은 shared_set_id 만 채우고 text_id 는 비운다(subscribe_article_word_set)
  const list = [...words, { id: 5, word: 'soybean', textId: null, setId: ASET }]
  const ctx = { textId: ARTICLE_TEXT, libraryBookId: null, chapterIdx: null, currentChapterWordSet: { id: ASET } }
  it('「단어」 는 set:<기사 세트>, book·chapter 없음 → 그 세트 단어만', () => {
    const href = readerWordsHref(ctx)
    const u = new URL(href, 'http://x')
    expect(u.searchParams.get('book')).toBeNull()
    expect(u.searchParams.get('chapter')).toBeNull()
    expect(browse(href, list).ids).toEqual([5])
  })
  it('예전처럼 text: 로 보냈다면 0 이었다(결함 재현)', () => {
    expect(browse(`/wordvault/browse?filter=text:${ARTICLE_TEXT}`, list).ids).toEqual([])
  })
  it('카드·게임 범위도 같은 출처 ?set=', () => {
    expect(readerScopeQuery(ctx)).toBe(`?set=${ASET}`)
  })
  it('세트 없는 기사·일반 글은 text 범위 · 맥락 없음은 null — 기존 의미', () => {
    expect(readerScopeQuery({ textId: A })).toBe(`?text=${A}`)
    expect(readerScopeQuery({ textId: A, libraryBookId: null, currentChapterWordSet: null })).toBe(`?text=${A}`)
    expect(readerScopeQuery(null)).toBeNull()
  })
  it('도서 장은 기존대로 set + book·chapter, 범위는 ?set=', () => {
    const c = { textId: A, libraryBookId: 'book-1', chapterIdx: 3, currentChapterWordSet: { id: SET } }
    expect(new URL(readerWordsHref(c), 'http://x').searchParams.get('book')).toBe('book-1')
    expect(readerScopeQuery(c)).toBe(`?set=${SET}`)
  })
  it('세트는 있는데 도서는 있고 장 번호가 없으면(비정상) 도서 장으로 꾸미지 않고 text 로', () => {
    expect(readerScopeQuery({ textId: A, libraryBookId: 'book-1', chapterIdx: null, currentChapterWordSet: { id: SET } })).toBe(`?text=${A}`)
  })
})
