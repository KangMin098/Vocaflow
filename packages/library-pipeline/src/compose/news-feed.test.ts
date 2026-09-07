// packages/library-pipeline/src/compose/news-feed.test.ts
// ACP §20 — 상업 뉴스 수집기 회귀. 네트워크 없이 전 경로를 돈다.
//
// 지키는 것:
//   ① 약관 확인 전에는 한 줄도 읽지 않는다.
//   ② 403 을 브라우저 UA 로 우회하지 않는다.
//   ③ 48시간 안 된 기사는 버리지 않고 보류한다 (버리면 다음 실행에서 다시 발견해야 한다).
//   ④ 반환값 어디에도 본문이 없다.

import { describe, expect, it } from 'vitest'

import { COMPOSE_USER_AGENT, CrawlGate } from './access'
import {
  countIndependentLines,
  discoverStories,
  primeRobots,
  readStoryForFacts,
  type FetchDeps,
  type FetchResult,
} from './news-feed'
import { FACT_SOURCES, type FactSourceSpec } from './sources'

const NOW = new Date('2026-08-17T00:00:00Z').getTime()
const H = 3_600_000

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel>
<item>
  <title>Quake hits central coast</title>
  <link>https://news.example/world/quake</link>
  <pubDate>${new Date(NOW - 72 * H).toUTCString()}</pubDate>
  <description>Three people were treated for minor injuries.</description>
</item>
<item>
  <title>Breaking: storm forms offshore</title>
  <link>https://news.example/world/storm</link>
  <pubDate>${new Date(NOW - 6 * H).toUTCString()}</pubDate>
  <description>Forecasters are watching the system.</description>
</item>
<item>
  <title>Section index</title>
  <link>https://news.example/world/</link>
  <description>No date here.</description>
</item>
</channel></rss>`

const ARTICLE_HTML =
  '<html><body><p>A magnitude 5.2 earthquake struck the central coast on Tuesday morning. County officials said three people were treated for minor injuries.</p></body></html>'

/** 약관 확인이 끝났다고 가정한 발행사 (실제 레지스트리는 false 로 잠겨 있다). */
function reviewed(base: FactSourceSpec, publisher = 'news.example'): FactSourceSpec {
  return {
    ...base,
    publisher,
    wiring: 'in-repo',
    access: { ...base.access, termsReviewed: true },
  }
}

function deps(routes: Record<string, FetchResult | (() => never)>): FetchDeps & { slept: number[]; seen: Array<{ url: string; ua: string }> } {
  const slept: number[] = []
  const seen: Array<{ url: string; ua: string }> = []
  return {
    slept,
    seen,
    async fetchText(url, h) {
      seen.push({ url, ua: h['User-Agent'] ?? '' })
      const r = routes[url]
      if (!r) return { ok: false, status: 404, text: '' }
      if (typeof r === 'function') return r()
      return r
    },
    now: () => NOW,
    async sleep(ms) {
      slept.push(ms)
    },
  }
}

const OK = (text: string): FetchResult => ({ ok: true, status: 200, text })

describe('primeRobots', () => {
  it('200 이면 규칙을 등록한다', async () => {
    const g = new CrawlGate()
    const d = deps({ 'https://news.example/robots.txt': OK('User-agent: *\nDisallow: /premium/\n') })
    expect(await primeRobots('news.example', g, d)).toBe('ok')
    expect(g.check('https://news.example/world/a', NOW).allowed).toBe(true)
    expect(g.check('https://news.example/premium/a', NOW).allowed).toBe(false)
  })

  it('404 는 규칙 없음 = 허용', async () => {
    const g = new CrawlGate()
    const d = deps({ 'https://news.example/robots.txt': { ok: false, status: 404, text: '' } })
    expect(await primeRobots('news.example', g, d)).toBe('absent')
    expect(g.check('https://news.example/world/a', NOW).allowed).toBe(true)
  })

  it('5xx·네트워크 실패는 차단으로 등록한다 (답을 못 준 것을 허락으로 읽지 않는다)', async () => {
    const g = new CrawlGate()
    expect(
      await primeRobots('news.example', g, deps({ 'https://news.example/robots.txt': { ok: false, status: 503, text: '' } })),
    ).toBe('failed')
    expect(g.check('https://news.example/world/a', NOW).allowed).toBe(false)

    const g2 = new CrawlGate()
    const boom = deps({
      'https://news.example/robots.txt': () => {
        throw new Error('ECONNRESET')
      },
    })
    expect(await primeRobots('news.example', g2, boom)).toBe('failed')
    expect(g2.check('https://news.example/world/a', NOW).allowed).toBe(false)
  })
})

describe('discoverStories', () => {
  const FEED_URL = 'https://news.example/feed.xml'

  async function ready(spec: FactSourceSpec) {
    const g = new CrawlGate()
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nAllow: /\n'),
      [FEED_URL]: OK(FEED),
    })
    await primeRobots('news.example', g, d)
    return { g, d, res: await discoverStories(spec, FEED_URL, g, d) }
  }

  it('약관 확인 전에는 요청 자체를 보내지 않는다', async () => {
    // 레지스트리의 승인 상태와 무관하게 성립해야 하는 불변식이므로 잠긴 사본을 쓴다.
    const locked: FactSourceSpec = {
      ...FACT_SOURCES['ap']!,
      access: { ...FACT_SOURCES['ap']!.access, termsReviewed: false },
    }
    const g = new CrawlGate()
    const d = deps({ [FEED_URL]: OK(FEED) })
    const res = await discoverStories(locked, FEED_URL, g, d)
    expect(res.ready).toEqual([])
    expect(res.skipped[0]!.reason).toContain('약관 확인 전에는 수집하지 않는다')
    expect(d.seen).toEqual([]) // 네트워크 접촉 0
  })

  it('48시간 지난 기사만 ready, 최신 기사는 보류로 남긴다', async () => {
    const { res } = await ready(reviewed(FACT_SOURCES['bbc']!))
    expect(res.ready.map((c) => c.url)).toEqual(['https://news.example/world/quake'])
    expect(res.holding.map((c) => c.url)).toEqual(['https://news.example/world/storm'])
    // 6시간 지났으므로 42시간 더 기다리면 된다
    expect(res.holding[0]!.holdMs).toBe(42 * H)
  })

  it('발행 시각 없는 항목은 제외한다 (I15 를 검증할 수 없다)', async () => {
    const { res } = await ready(reviewed(FACT_SOURCES['bbc']!))
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0]!.reason).toContain('발행 시각 없음')
  })

  it('우리 UA 로 요청한다', async () => {
    const { d } = await ready(reviewed(FACT_SOURCES['bbc']!))
    expect(d.seen.every((s) => s.ua === COMPOSE_USER_AGENT)).toBe(true)
  })

  it('403 은 우회하지 않고 발행사를 뺄 근거로 돌려준다', async () => {
    const g = new CrawlGate()
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nAllow: /\n'),
      [FEED_URL]: { ok: false, status: 403, text: '' },
    })
    await primeRobots('news.example', g, d)
    const res = await discoverStories(reviewed(FACT_SOURCES['bbc']!), FEED_URL, g, d)
    expect(res.skipped[0]!.reason).toContain('브라우저 UA 로 우회하지 않는다')
    expect(d.seen).toHaveLength(2) // robots + feed. 재시도 없음
  })

  it('robots 미확인 호스트는 읽지 않는다', async () => {
    const g = new CrawlGate()
    const d = deps({ [FEED_URL]: OK(FEED) })
    const res = await discoverStories(reviewed(FACT_SOURCES['bbc']!), FEED_URL, g, d)
    expect(res.skipped[0]!.reason).toContain('robots.txt 미확인')
    expect(d.seen).toEqual([])
  })

  it('요청 간격이 남았으면 기다린 뒤 읽는다', async () => {
    const g = new CrawlGate()
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nAllow: /\nCrawl-delay: 10\n'),
      [FEED_URL]: OK(FEED),
    })
    await primeRobots('news.example', g, d)
    g.markFetched('https://news.example/x', NOW - 2_000)
    await discoverStories(reviewed(FACT_SOURCES['bbc']!), FEED_URL, g, d)
    expect(d.slept).toEqual([8_000]) // Crawl-delay 10s - 이미 지난 2s
  })
})

describe('countIndependentLines — 계통으로 센다', () => {
  it('같은 통신사 원고는 여러 발행사여도 1개', () => {
    const wireCopy = [
      { publisher: 'reuters.com', wire: 'reuters' },
      { publisher: 'local-a.example', wire: 'reuters' },
      { publisher: 'local-b.example', wire: 'reuters' },
    ] as Parameters<typeof countIndependentLines>[0]
    expect(countIndependentLines(wireCopy)).toBe(1)
  })

  it('계통이 다르면 2개', () => {
    const mixed = [
      { publisher: 'reuters.com', wire: 'reuters' },
      { publisher: 'bbc.co.uk', wire: null },
    ] as Parameters<typeof countIndependentLines>[0]
    expect(countIndependentLines(mixed)).toBe(2)
  })
})

describe('readStoryForFacts', () => {
  const URL_A = 'https://news.example/world/quake'

  async function read() {
    const g = new CrawlGate()
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nAllow: /\n'),
      [URL_A]: OK(ARTICLE_HTML),
    })
    await primeRobots('news.example', g, d)
    return readStoryForFacts(reviewed(FACT_SOURCES['bbc']!), URL_A, g, d, (body) => ({
      injured: /three people were treated/.test(body) ? 3 : 0,
    }))
  }

  it('지문과 추출 결과만 남고 본문은 어디에도 없다', async () => {
    const r = await read()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.read.extracted.injured).toBe(3)
    expect(r.read.fingerprint.hashes.length).toBeGreaterThan(0)
    expect(JSON.stringify(r)).not.toContain('earthquake')
  })

  it('DB INSERT 모양에 본문 컬럼이 없고 robots 확인 시각이 채워진다', async () => {
    const r = await read()
    if (!r.ok) throw new Error(r.reason)
    expect(Object.keys(r.row).sort()).toEqual([
      'access_basis',
      'fingerprint',
      'published_at',
      'publisher',
      'robots_checked_at',
      'url',
      'wire',
    ])
    expect(r.row.access_basis).toBe('publisher-feed')
    expect(r.row.robots_checked_at).not.toBeNull()
    expect(r.row.wire).toBeNull() // BBC 는 자체 취재
  })

  it('통신사 소속은 wire 가 기록된다', async () => {
    const g = new CrawlGate()
    const d = deps({
      'https://news.example/robots.txt': OK('User-agent: *\nAllow: /\n'),
      [URL_A]: OK(ARTICLE_HTML),
    })
    await primeRobots('news.example', g, d)
    const r = await readStoryForFacts(reviewed(FACT_SOURCES['ap']!), URL_A, g, d, () => null)
    if (!r.ok) throw new Error(r.reason)
    expect(r.row.wire).toBe('ap')
  })

  it('약관 미확인이면 읽지 않는다', async () => {
    const locked: FactSourceSpec = {
      ...FACT_SOURCES['ap']!,
      access: { ...FACT_SOURCES['ap']!.access, termsReviewed: false },
    }
    const g = new CrawlGate()
    const d = deps({})
    const r = await readStoryForFacts(locked, URL_A, g, d, () => null)
    expect(r.ok).toBe(false)
    expect(d.seen).toEqual([])
  })
})
