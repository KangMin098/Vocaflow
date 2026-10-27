// apps/web/src/lib/wordvault/__tests__/set-membership.test.ts
// 기사 단어장에 이미 다른 출처로 가진 낱말이 빠지지 않게 — origin + 정본 membership(정확한 낱말), 행 복제·혼입 없음.
import { describe, expect, it } from 'vitest'
import { applySourceFilter, type SetMembership } from '../source-filter'
import { loadArticleSetMembership } from '../set-membership-query'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // 기사 세트 A
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // 다른 세트 B
const T = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 직접 글
const mine = [
  { id: 1, word: 'flooding', setId: A, textId: null }, // A 에서 구독
  { id: 2, word: 'harvest', setId: B, textId: null }, //  B 에서 먼저 가짐 · A 정본에도 있음
  { id: 3, word: 'satellite', setId: null, textId: T }, // 직접 글에서 · A 정본에도 있음
  { id: 4, word: 'drought', setId: B, textId: null }, //  B 에만 · A 정본에 없음
]
const memA: SetMembership = { setId: A, words: new Set(['flooding', 'harvest', 'satellite', 'soybean']) }

describe('applySourceFilter — 기사 세트 membership', () => {
  it('A 를 고르면 origin A + 정본에 있는 B·직접 글 출처 본인 단어, 각 한 번', () => {
    expect(applySourceFilter(mine, `set:${A}`, memA).map((w) => w.id)).toEqual([1, 2, 3])
  })
  it('A 정본에 없는 B 낱말은 섞이지 않는다 · 정본에만 있고 본인이 없는 낱말(soybean)은 만들지 않는다', () => {
    const ids = applySourceFilter(mine, `set:${A}`, memA).map((w) => w.word)
    expect(ids).not.toContain('drought')
    expect(ids).not.toContain('soybean')
  })
  it('membership 은 그 세트에만 — B 로 옮기면 origin B 만, text: 도 영향 없음', () => {
    expect(applySourceFilter(mine, `set:${B}`, memA).map((w) => w.id)).toEqual([2, 4])
    expect(applySourceFilter(mine, `text:${T}`, memA).map((w) => w.id)).toEqual([3])
  })
  it('대소문자·변형은 합치지 않는다(정확한 낱말만)', () => {
    expect(applySourceFilter([{ id: 9, word: 'Harvest', setId: B, textId: null }], `set:${A}`, memA)).toEqual([])
  })
  it('조회 실패 membership 은 origin 만(정본 추정 없음)', () => {
    expect(applySourceFilter(mine, `set:${A}`, { setId: A, error: true }).map((w) => w.id)).toEqual([1])
  })
})

function fakeClient(opts: { set?: unknown; setErr?: unknown; words?: string[]; wordsErr?: unknown }) {
  return {
    from: (t: string) => {
      if (t === 'shared_word_sets') {
        const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: opts.set ?? null, error: opts.setErr ?? null }) }
        return q
      }
      const q = { select: () => q, eq: () => q, range: async (from: number, to: number) => ({ data: opts.wordsErr ? null : (opts.words ?? []).slice(from, to + 1).map((word) => ({ word })), error: opts.wordsErr ?? null }) }
      return q
    },
  } as never
}

describe('loadArticleSetMembership', () => {
  const art = { id: A, category: 'library_article', is_published: true }
  it('발행 기사 세트면 정본 낱말', async () => {
    expect(await loadArticleSetMembership(fakeClient({ set: art, words: ['flooding', 'harvest'] }), `set:${A}`)).toEqual({ setId: A, words: ['flooding', 'harvest'] })
  })
  it('세트 필터 아님·도서 세트·미발행·없는 세트는 null(기존 origin 판정)', async () => {
    expect(await loadArticleSetMembership(fakeClient({ set: art }), `text:${T}`)).toBeNull()
    expect(await loadArticleSetMembership(fakeClient({ set: art }), ['x'])).toBeNull()
    expect(await loadArticleSetMembership(fakeClient({ set: { ...art, category: 'library_book' } }), `set:${A}`)).toBeNull()
    expect(await loadArticleSetMembership(fakeClient({ set: { ...art, is_published: false } }), `set:${A}`)).toBeNull()
    expect(await loadArticleSetMembership(fakeClient({ set: null }), `set:${A}`)).toBeNull()
  })
  it('조회 실패는 error — 0 이나 전체로 숨기지 않는다', async () => {
    expect(await loadArticleSetMembership(fakeClient({ setErr: { message: 'x' } }), `set:${A}`)).toEqual({ setId: A, error: true })
    expect(await loadArticleSetMembership(fakeClient({ set: art, wordsErr: { message: 'x' } }), `set:${A}`)).toEqual({ setId: A, error: true })
  })
  it('1000 넘는 세트도 끝까지 읽는다', async () => {
    const many = Array.from({ length: 1500 }, (_, i) => `w${i}`)
    const r = await loadArticleSetMembership(fakeClient({ set: art, words: many }), `set:${A}`)
    expect(r && 'words' in r ? r.words.length : -1).toBe(1500)
  })
})
