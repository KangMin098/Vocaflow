// apps/web/src/lib/wordvault/__tests__/scope-words-href.test.ts
// P-5 — 게임 범위(?set= · ?text=)에서 단어 목록으로. Browse 가 읽는 filter 값(set:·text:)과 같아야 한다.
import { describe, expect, it } from 'vitest'
import { applySourceFilter, normalizeSourceFilter, scopeWordsHref } from '../source-filter'

const filterOf = (href: string) => normalizeSourceFilter(new URL(href, 'http://x').searchParams.get('filter'))

describe('scopeWordsHref', () => {
  it('set 범위 → set: 필터, text 보다 앞선다', () => {
    expect(scopeWordsHref({ set: 's1', text: 't1' })).toBe('/wordvault/browse?filter=set%3As1')
    expect(filterOf(scopeWordsHref({ set: 's1' }))).toBe('set:s1')
  })
  it('text 범위 → text: 필터, Browse 가 그 글 단어만 거른다', () => {
    const f = filterOf(scopeWordsHref({ text: 't1' }))
    expect(f).toBe('text:t1')
    expect(applySourceFilter([{ textId: 't1' }, { textId: 't2' }], f)).toEqual([{ textId: 't1' }])
  })
  it('범위가 없거나 빈 값이면 단어장 허브', () => {
    expect(scopeWordsHref({})).toBe('/wordvault')
    expect(scopeWordsHref({ set: ' ', text: '' })).toBe('/wordvault')
  })
})
