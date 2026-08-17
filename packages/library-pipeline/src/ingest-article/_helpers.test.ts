// packages/library-pipeline/src/ingest-article/_helpers.test.ts
// decodeEntities 회귀 잠금 — 특히 hex 수치 엔티티(&#x27; 등). v06.208 이전엔 hex 미처리로 제목에 잔존했음.

import { describe, expect, it } from 'vitest'

import { decodeEntities, parseRssFeed } from './_helpers'

describe('decodeEntities', () => {
  it('hex 수치 엔티티(&#x27;)를 아포스트로피로 디코드 (회귀: owid/voa 제목 잔존 버그)', () => {
    expect(decodeEntities('How to &#x27;Dish Up&#x27; Something Good')).toBe("How to 'Dish Up' Something Good")
    expect(decodeEntities('doesn&#x27;t reflect that')).toBe("doesn't reflect that")
  })

  it('십진 수치 엔티티 + named 엔티티', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b')
    expect(decodeEntities('&lt;tag&gt;')).toBe('<tag>')
    expect(decodeEntities('it&#39;s')).toBe("it's")
    expect(decodeEntities('&quot;quote&quot;')).toBe('"quote"')
  })

  it('hex 대문자/다바이트 코드포인트도 처리', () => {
    expect(decodeEntities('&#x2019;')).toBe('’') // right single quote
    expect(decodeEntities('caf&#xE9;')).toBe('café')
  })

  it('엔티티 없으면 원문 유지', () => {
    expect(decodeEntities('plain text')).toBe('plain text')
  })
})

describe('parseRssFeed — 발행 시각', () => {
  const item = (dateTag: string): string =>
    `<?xml version="1.0"?><rss><channel><item><title>T</title><link>https://x/a</link>${dateTag}<description>d</description></item></channel></rss>`

  it('RSS 2.0 pubDate', () => {
    expect(parseRssFeed(item('<pubDate>Fri, 14 Aug 2026 09:00:00 GMT</pubDate>'))[0]!.published_at)
      .toBe('2026-08-14T09:00:00.000Z')
  })

  it('Atom published', () => {
    expect(parseRssFeed(item('<published>2026-08-14T09:00:00Z</published>'))[0]!.published_at)
      .toBe('2026-08-14T09:00:00.000Z')
  })

  it('RSS 1.0(RDF) dc:date — 없으면 그 피드의 모든 항목이 시각 없음으로 버려진다', () => {
    // 2026-08-18 실측: DW rss-en-all 137항목이 전부 이 이유로 빠졌다.
    expect(parseRssFeed(item('<dc:date>2026-08-14T09:00:00Z</dc:date>'))[0]!.published_at)
      .toBe('2026-08-14T09:00:00.000Z')
  })

  it('시각 태그가 아예 없으면 null', () => {
    expect(parseRssFeed(item(''))[0]!.published_at).toBeNull()
  })
})
