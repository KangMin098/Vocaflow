// apps/web/src/lib/reader/__tests__/public-source-href.test.ts
import { describe, expect, it } from 'vitest'

import { publicSourceHref } from '../public-source-href'

describe('publicSourceHref', () => {
  it('공개 https·http 절대 주소는 통과', () => {
    expect(publicSourceHref('https://www.bbc.com/news/a-1')).toBe('https://www.bbc.com/news/a-1')
    expect(publicSourceHref('  http://example.org/x ')).toBe('http://example.org/x')
  })
  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<b>x</b>'],
    ['article:123e4567-e89b-12d3-a456-426614174000'],
    ['/text/abc'],
    ['example.org/x'],
    ['https://'],
    ['ftp://example.org/f'],
    [''],
    ['   '],
  ])('거부: %s', (raw) => {
    expect(publicSourceHref(raw)).toBeNull()
  })
  it('문자열이 아니면 null', () => {
    expect(publicSourceHref(null)).toBeNull()
    expect(publicSourceHref(undefined)).toBeNull()
    expect(publicSourceHref(42)).toBeNull()
  })
})
