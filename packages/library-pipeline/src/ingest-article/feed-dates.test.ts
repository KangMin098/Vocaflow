// packages/library-pipeline/src/ingest-article/feed-dates.test.ts
//
// 발행 시각이 퇴화한 피드 되살리기.
//
// 실측 근거 (2026-08-19): 코리아타임스 allnews.xml 37항목의 pubDate 가 전부 하나였다.
// 그 결과 후보 105건이 서로 다른 분 5개에 뭉쳐 있었고, 연합이 익었을 때 짝이 될 기사가
// 늘 안 익은 상태여서 **한국 매체끼리 독립 2계통을 만드는 경로가 끊겨 있었다.**

import { describe, expect, it } from 'vitest'

import { dateFromUrl, parseRssFeed } from './_helpers'

const NOW = Date.UTC(2026, 7, 19, 2, 38, 0)

/** 실측 그대로 — 모든 항목이 같은 pubDate, 주소에는 진짜 날짜가 박혀 있다. */
const degenerateXml = (days: string[]) =>
  `<rss><channel>${days
    .map(
      (d, i) => `<item>
        <title>기사 ${i}</title>
        <link>https://www.koreatimes.co.kr/southkorea/${d}/story-${i}?utm_source=rss</link>
        <pubDate>Wed, 19 Aug 2026 02:32:03 GMT</pubDate>
        <description>설명</description>
      </item>`,
    )
    .join('')}</channel></rss>`

/** 정상 피드 — 항목마다 다른 시각. */
const healthyXml = `<rss><channel>${[
  'Wed, 19 Aug 2026 11:29:16 +09:00',
  'Wed, 19 Aug 2026 11:27:48 +09:00',
  'Wed, 19 Aug 2026 11:26:37 +09:00',
  'Wed, 19 Aug 2026 11:25:36 +09:00',
  'Wed, 19 Aug 2026 11:12:44 +09:00',
  'Wed, 19 Aug 2026 10:35:01 +09:00',
]
  .map(
    (d, i) => `<item>
      <title>herald ${i}</title>
      <link>https://www.koreaherald.com/article/20260817${i}</link>
      <pubDate>${d}</pubDate>
    </item>`,
  )
  .join('')}</channel></rss>`

describe('dateFromUrl — 주소에서 발행일 되찾기', () => {
  it('세 가지 흔한 모양을 모두 읽는다', () => {
    for (const u of [
      'https://x.com/a/20260817/slug',
      'https://x.com/a/2026/08/17/slug',
      'https://x.com/a/2026-08-17/slug',
    ]) {
      expect(dateFromUrl(u, NOW), u).toBe('2026-08-17T23:59:59.999Z')
    }
  })

  it('그날의 **끝**을 돌려준다 — 발행 지연이 절대 일찍 풀리면 안 된다', () => {
    // 00:00 으로 잡으면 최대 24시간 일찍 익는다. 48시간 보류의 취지가 깨진다.
    const iso = dateFromUrl('https://x.com/a/20260817/s', NOW)!
    expect(iso.endsWith('T23:59:59.999Z')).toBe(true)
  })

  it('쿼리스트링이 바로 붙어도 읽는다', () => {
    expect(dateFromUrl('https://x.com/a/20260817?utm_source=rss', NOW)).toBe(
      '2026-08-17T23:59:59.999Z',
    )
  })

  it('미래 날짜는 거절한다 — 주소에 섞인 다른 숫자다', () => {
    expect(dateFromUrl('https://x.com/a/20270101/s', NOW)).toBeNull()
  })

  it('없는 날짜(2026-02-31)는 다음 달로 굴리지 않고 거절한다', () => {
    expect(dateFromUrl('https://x.com/a/20260231/s', NOW)).toBeNull()
  })

  it('날짜가 아닌 긴 숫자에 속지 않는다', () => {
    expect(dateFromUrl('https://x.com/story/12345678/s', NOW)).toBeNull()
    expect(dateFromUrl('https://x.com/a/19891231/s', NOW)).toBeNull()
  })

  it('날짜가 없으면 null — 지어내지 않는다', () => {
    expect(dateFromUrl('https://x.com/some/slug-only', NOW)).toBeNull()
  })
})

describe('parseRssFeed — 퇴화한 피드만 되살린다', () => {
  it('전 항목이 같은 시각이면 주소의 날짜로 바꾼다', () => {
    const items = parseRssFeed(degenerateXml(Array(8).fill('20260817')))
    expect(items).toHaveLength(8)
    for (const it of items) {
      expect(it.published_at).toBe('2026-08-17T23:59:59.999Z')
      expect(it.date_source).toBe('url')
    }
  })

  it('되살리면 서로 다른 날짜가 실제로 갈린다 — 뭉침이 풀린다', () => {
    const items = parseRssFeed(degenerateXml(['20260815', '20260816', '20260817', '20260817', '20260818', '20260819']))
    const distinct = new Set(items.map((i) => i.published_at))
    expect(distinct.size).toBe(5)
  })

  it('정상 피드는 건드리지 않는다 — 시각이 하루 단위로 뭉개지면 손해다', () => {
    const items = parseRssFeed(healthyXml)
    expect(items).toHaveLength(6)
    expect(items[0]!.published_at).toBe('2026-08-19T02:29:16.000Z')
    for (const it of items) expect(it.date_source).toBeUndefined()
  })

  it('항목이 5건 미만이면 판정하지 않는다 — 얇은 표본으로 단정하지 않는다', () => {
    const items = parseRssFeed(degenerateXml(['20260817', '20260817', '20260817']))
    for (const it of items) {
      expect(it.published_at).toBe('2026-08-19T02:32:03.000Z')
      expect(it.date_source).toBeUndefined()
    }
  })

  it('퇴화했는데 주소에 날짜가 없으면 원래 값을 유지한다 — 없는 것보다 낫다', () => {
    const xml = `<rss><channel>${Array.from(
      { length: 6 },
      (_, i) => `<item><title>t${i}</title><link>https://x.com/slug-${i}</link>
        <pubDate>Wed, 19 Aug 2026 02:32:03 GMT</pubDate></item>`,
    ).join('')}</channel></rss>`
    const items = parseRssFeed(xml)
    expect(items).toHaveLength(6)
    for (const it of items) {
      expect(it.published_at).toBe('2026-08-19T02:32:03.000Z')
      expect(it.date_source).toBeUndefined()
    }
  })
})
