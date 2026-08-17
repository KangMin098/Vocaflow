// packages/library-pipeline/src/compose/feed-discovery.test.ts
// ACP §20 — 피드 자동 발견 회귀.
//
// 지키는 것: **관리자가 주소를 찾아 오지 않아도 된다.** 발행사만 고르면 시스템이
// 발행사가 스스로 알린 피드를 찾아 확인까지 마치고 목록으로 준다.
// 그리고 "아마 될 것" 을 목록에 올리지 않는다 — 열어 보고 항목이 있는 것만 올린다.

import { describe, expect, it } from 'vitest'

import { CrawlGate } from './access'
import {
  FEED_CONVENTIONS,
  discoverFeeds,
  looksLikeFeed,
  parseFeedAnchors,
  parseFeedLinks,
  verifyFeedUrl,
} from './feed-discovery'
import type { FetchDeps, FetchResult } from './news-feed'
import { FACT_SOURCES, type FactSourceSpec } from './sources'

const NOW = Date.parse('2026-08-17T00:00:00Z')

const FEED_XML = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>World News</title>
<item><title>A</title><link>https://news.example/a</link><pubDate>Fri, 14 Aug 2026 09:00:00 GMT</pubDate><description>d</description></item>
<item><title>B</title><link>https://news.example/b</link><pubDate>Fri, 14 Aug 2026 10:00:00 GMT</pubDate><description>d</description></item>
</channel></rss>`

const HOME_WITH_LINKS = `<!doctype html><html><head>
<title>News Example</title>
<link rel="stylesheet" href="/a.css">
<link rel="alternate" type="application/rss+xml" title="World" href="/feeds/world.xml">
<link rel='alternate' type='application/atom+xml' title='Business' href='https://news.example/feeds/business.atom'>
<link rel="alternate" hreflang="fr" href="/fr/">
<link rel="alternate" type="application/rss+xml" title="World" href="/feeds/world.xml">
</head><body>hi</body></html>`

const HOME_NO_LINKS = '<!doctype html><html><head><title>News</title></head><body>hi</body></html>'

function deps(routes: Record<string, FetchResult>): FetchDeps & { seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    async fetchText(url) {
      seen.push(url)
      return routes[url] ?? { ok: false, status: 404, text: '' }
    },
    now: () => NOW,
    async sleep() {},
  }
}

const OK = (text: string): FetchResult => ({ ok: true, status: 200, text })
const ALLOW = OK('User-agent: *\nAllow: /\n')

/** 실제 레지스트리 spec 의 발행사만 테스트 호스트로 바꾼다. */
function at(key: string, publisher: string): FactSourceSpec {
  return { ...FACT_SOURCES[key]!, publisher }
}

describe('parseFeedLinks', () => {
  it('rel=alternate + 피드 타입만 골라 절대주소로 만든다', () => {
    const links = parseFeedLinks(HOME_WITH_LINKS, 'https://news.example/')
    expect(links.map((l) => l.url)).toEqual([
      'https://news.example/feeds/world.xml',
      'https://news.example/feeds/business.atom',
    ])
    expect(links[0]!.title).toBe('World')
  })

  it('다국어 alternate 처럼 피드가 아닌 것은 거른다', () => {
    expect(parseFeedLinks(HOME_WITH_LINKS, 'https://news.example/').map((l) => l.url)).not.toContain(
      'https://news.example/fr/',
    )
  })

  it('같은 주소가 두 번 알려져도 한 번만', () => {
    const links = parseFeedLinks(HOME_WITH_LINKS, 'https://news.example/')
    expect(new Set(links.map((l) => l.url)).size).toBe(links.length)
  })

  it('피드 링크가 없으면 빈 배열', () => {
    expect(parseFeedLinks(HOME_NO_LINKS, 'https://news.example/')).toEqual([])
  })
})

describe('looksLikeFeed', () => {
  it('항목이 파싱되면 피드', () => {
    const r = looksLikeFeed(FEED_XML)
    expect(r.ok).toBe(true)
    expect(r.itemCount).toBe(2)
    expect(r.title).toBe('World News')
  })

  it('HTML 은 피드가 아니다', () => {
    expect(looksLikeFeed(HOME_WITH_LINKS).ok).toBe(false)
  })
})

describe('parseFeedAnchors — RSS 안내 페이지에서 목록 줍기', () => {
  const INDEX_PAGE = `<html><body>
    <a href="/news/rss.xml">World</a>
    <a href="/about">About</a>
    <a href="https://news.example/feeds/business.atom">Business</a>
    <a href="/rss/sport">Sport</a>
    <a href="/news/rss.xml">World again</a>
  </body></html>`

  it('피드처럼 보이는 링크만 줍고 중복은 접는다', () => {
    expect(parseFeedAnchors(INDEX_PAGE, 'https://news.example/')).toEqual([
      'https://news.example/news/rss.xml',
      'https://news.example/feeds/business.atom',
      'https://news.example/rss/sport',
    ])
  })

  it('발행사가 alternate 로 안 알리고 목록 페이지만 둬도 찾아낸다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(INDEX_PAGE),
      'https://news.example/news/rss.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': { ok: false, status: 404, text: '' },
      'https://news.example/rss/sport': { ok: false, status: 404, text: '' },
    })
    const r = await discoverFeeds(at('bbc', 'news.example'), new CrawlGate(), d)
    expect(r.feeds.map((f) => f.url)).toEqual(['https://news.example/news/rss.xml'])
  })
})

describe('verifyFeedUrl — 자동 발견이 실패했을 때의 백스톱', () => {
  const spec = at('bbc', 'news.example')

  it('직접 넣은 주소도 열어서 확인한 뒤에만 인정한다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/odd/path.xml': OK(FEED_XML),
    })
    const r = await verifyFeedUrl(spec, 'https://news.example/odd/path.xml', new CrawlGate(), d)
    expect('feed' in r).toBe(true)
    if (!('feed' in r)) return
    expect(r.feed.verified).toBe(true)
    expect(r.feed.itemCount).toBe(2)
  })

  it('피드가 아니면 직접 넣어도 거부한다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/page': OK(HOME_NO_LINKS),
    })
    const r = await verifyFeedUrl(spec, 'https://news.example/page', new CrawlGate(), d)
    expect('fail' in r).toBe(true)
    if (!('fail' in r)) return
    expect(r.fail.kind).toBe('not-a-feed')
  })

  it('robots 가 막은 주소는 직접 넣어도 안 연다', async () => {
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nDisallow: /private/\n'),
      'https://news.example/private/f.xml': OK(FEED_XML),
    })
    const r = await verifyFeedUrl(spec, 'https://news.example/private/f.xml', new CrawlGate(), d)
    expect('fail' in r).toBe(true)
    if (!('fail' in r)) return
    expect(r.fail.kind).toBe('robots-disallow')
    expect(d.seen).not.toContain('https://news.example/private/f.xml')
  })
})

describe('discoverFeeds — 관리자는 발행사만 고른다', () => {
  const spec = at('bbc', 'news.example')

  it('발행사가 알린 피드를 찾아 확인까지 마치고 돌려준다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': OK(FEED_XML),
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds).toHaveLength(2)
    expect(r.feeds.every((f) => f.verified && f.via === 'autodiscovery')).toBe(true)
    expect(r.feeds[0]!.title).toBe('World')
    expect(r.feeds[0]!.itemCount).toBe(2)
  })

  it('"아마 될 것" 을 목록에 올리지 않는다 — 열어 보고 항목이 없으면 뺀다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': OK(HOME_NO_LINKS), // 피드가 아님
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds.map((f) => f.url)).toEqual(['https://news.example/feeds/world.xml'])
    expect(r.skipped.some((s) => s.reason.includes('피드가 아닙니다'))).toBe(true)
  })

  it('알림이 없으면 그 발행사의 알려진 피드 경로부터 두드린다', async () => {
    // 대형 발행사는 홈페이지에서 자동 수집기를 막지만 피드는 배포용이라 열리는 일이 흔하다.
    // 주소를 아는 것은 시스템의 일이므로, 사람이 찾아오게 두지 않고 힌트부터 시도한다.
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_NO_LINKS),
      'https://news.example/news/rss.xml': OK(FEED_XML), // FACT_SOURCES.bbc.feedHints 첫 항목
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds).toHaveLength(1)
    expect(r.feeds[0]!.url).toBe('https://news.example/news/rss.xml')
    expect(r.feeds[0]!.via).toBe('convention')
  })

  it('힌트가 없는 발행사만 일반 관습 경로로 내려간다', async () => {
    const noHints: FactSourceSpec = { ...spec, feedHints: undefined }
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_NO_LINKS),
      'https://news.example/feed': OK(FEED_XML),
    })
    const r = await discoverFeeds(noHints, new CrawlGate(), d)
    expect(r.feeds.map((f) => f.url)).toEqual(['https://news.example/feed'])
  })

  it('홈페이지가 막혀도 거기서 끝내지 않는다 — 피드는 따로 열릴 수 있다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': { ok: false, status: 403, text: '' },
      'https://news.example/news/rss.xml': OK(FEED_XML),
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds).toHaveLength(1)
    expect(r.skipped.some((s) => s.reason.includes('홈페이지를 읽지 못했습니다'))).toBe(true)
  })

  it('apex 가 robots 를 안 주면 www 에서 찾는다', async () => {
    // 대형 발행사는 robots·피드를 www 호스트에서만 서비스하는 경우가 흔하다.
    // apex 만 보면 "robots 를 못 가져왔다" 로 끝나 발견 자체가 안 된다.
    const d = deps({
      'https://news.example/robots.txt': { ok: false, status: 503, text: '' },
      'https://www.news.example/robots.txt': ALLOW,
      'https://www.news.example/': OK(HOME_WITH_LINKS),
      'https://www.news.example/feeds/world.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': OK(FEED_XML),
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds.some((f) => f.url.includes('www.news.example'))).toBe(true)
  })

  it('알림이 있으면 관습 경로를 두드리지 않는다 (헛된 요청 금지)', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': OK(FEED_XML),
    })
    await discoverFeeds(spec, new CrawlGate(), d)
    for (const p of FEED_CONVENTIONS) {
      expect(d.seen).not.toContain(`https://news.example${p}`)
    }
  })

  it('두 호스트 모두 robots 를 못 주면 홈페이지도 열지 않는다', async () => {
    const d = deps({
      'https://news.example/robots.txt': { ok: false, status: 503, text: '' },
      'https://www.news.example/robots.txt': { ok: false, status: 503, text: '' },
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds).toEqual([])
    expect(r.skipped.every((s) => s.reason.includes('robots.txt 를 가져오지 못했습니다'))).toBe(true)
    expect(d.seen).toEqual([
      'https://news.example/robots.txt',
      'https://www.news.example/robots.txt',
    ])
  })

  it('robots 가 막은 경로는 열지 않는다', async () => {
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nDisallow: /feeds/\n'),
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(FEED_XML),
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.feeds).toEqual([])
    expect(r.skipped.some((s) => s.reason.includes('robots.txt 가'))).toBe(true)
    expect(d.seen).not.toContain('https://news.example/feeds/world.xml')
  })

  it('약관 미확인 소스는 조회 자체를 하지 않는다', async () => {
    const locked: FactSourceSpec = {
      ...spec,
      access: { ...spec.access, termsReviewed: false },
    }
    const d = deps({})
    const r = await discoverFeeds(locked, new CrawlGate(), d)
    expect(d.seen).toEqual([])
    expect(r.skipped[0]!.reason).toContain('이용약관 확인 전')
  })

  it('403 은 우회하지 않고 유형·다음 행동과 함께 남긴다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': { ok: false, status: 403, text: '' },
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d, { tryConventions: false })
    const refused = r.skipped.find((s) => s.kind === 'refused')
    expect(refused).toBeDefined()
    // 운영자는 "안 되네" 가 아니라 "다음에 뭘 할지" 를 받아야 한다
    expect(refused!.nextAction).toContain('우회하지 않는다')
  })

  it('실패마다 유형과 다음 행동이 붙는다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(HOME_NO_LINKS), // 피드 아님
      'https://news.example/feeds/business.atom': { ok: false, status: 404, text: '' },
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    const kinds = new Set(r.skipped.map((s) => s.kind))
    // 알림 후보가 전부 실패하면 힌트로 되돌아가므로(AP 실측 대응) 그쪽 실패도 함께 쌓인다.
    expect(kinds.has('not-a-feed')).toBe(true)
    expect(kinds.has('not-found')).toBe(true)
    expect(r.skipped.every((s) => s.nextAction.length > 10)).toBe(true)
  })

  it('보낸 요청 수를 스스로 센다', async () => {
    const d = deps({
      'https://news.example/robots.txt': ALLOW,
      'https://news.example/': OK(HOME_WITH_LINKS),
      'https://news.example/feeds/world.xml': OK(FEED_XML),
      'https://news.example/feeds/business.atom': OK(FEED_XML),
    })
    const r = await discoverFeeds(spec, new CrawlGate(), d)
    expect(r.requests).toBe(5) // robots ×2(apex·www) + home + 후보 2
  })
})
