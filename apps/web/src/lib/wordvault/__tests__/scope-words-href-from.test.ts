// apps/web/src/lib/wordvault/__tests__/scope-words-href-from.test.ts
// T-0268 — 게임 완료 「이 자료의 단어 보기」 링크가 검증된 ?from= 을 이어 준다(단어장에서 닫기/Esc → 읽던 글). 악성 · 누락은 기존 목적지.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSourceFilter, scopeWordsHref } from '../source-filter'

const q = (href: string) => new URL(href, 'http://x').searchParams

describe('scopeWordsHref — from', () => {
  it('set · text 범위 + 유효한 내부 from → filter 는 그대로, from 을 덧붙인다', () => {
    const a = scopeWordsHref({ set: 's1', from: '/text/abc?mode=read' })
    expect(normalizeSourceFilter(q(a).get('filter'))).toBe('set:s1')
    expect(q(a).get('from')).toBe('/text/abc?mode=read')
    const b = scopeWordsHref({ text: 't1', from: '/library/scripts/x' })
    expect(normalizeSourceFilter(q(b).get('filter'))).toBe('text:t1')
    expect(q(b).get('from')).toBe('/library/scripts/x')
  })
  it('누락 · 외부 주소 · 프로토콜 상대 · 역슬래시 · 제어문자 · 공백은 from 없이 기존 목적지', () => {
    for (const from of [undefined, null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/a\u0000b', '/a b', 'javascript:alert(1)']) {
      expect(scopeWordsHref({ set: 's1', from })).toBe('/wordvault/browse?filter=set%3As1')
      expect(scopeWordsHref({ text: 't1', from })).toBe(`/wordvault/browse?filter=${encodeURIComponent('text:t1')}`)
    }
  })
  it('범위 없는 단어장 허브는 from 이 있어도 그대로 /wordvault', () => {
    expect(scopeWordsHref({ from: '/text/abc' })).toBe('/wordvault')
    expect(scopeWordsHref({ set: ' ', text: '', from: '/text/abc' })).toBe('/wordvault')
  })
})

describe('WordBlitz 완료 링크 배선', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../../app/(app)/play/wordblitz/page.tsx'), 'utf8')
  it('완료 링크가 scope 의 from 까지 넘기고 라벨 판정은 허브 여부로 그대로', () => {
    expect(page).toMatch(/wordsLink=\{wordBlitzWordsLink\(scope\)\}/)
    expect(page).toMatch(/function wordBlitzWordsLink\(scope: Pick<WordScope, 'set' \| 'text' \| 'from'>\)/)
    expect(page).toMatch(/label: href === '\/wordvault' \? '내 단어장으로' : '이 자료의 단어 보기'/)
  })
})
