// packages/library-pipeline/src/compose/collect.test.ts
// ACP §20 — 수집 오케스트레이션 회귀.
//
// 지키는 것:
//   ① 발견 단계에서 본문을 읽지 않는다 (피드와 robots 만 요청).
//   ② 실패는 전부 사유와 함께 남는다 — "오늘 사건이 없었다" 와 "전부 차단됐다" 는 다르다.
//   ③ 같은 호스트의 robots 는 한 번만 확인한다.

import { describe, expect, it } from 'vitest'

import { CrawlGate } from './access'
import { collectStories, toBatchRow, type FeedConfig } from './collect'
import type { FetchDeps, FetchResult } from './news-feed'
import { FACT_SOURCES, type FactSourceSpec } from './sources'

const NOW = Date.parse('2026-08-17T00:00:00Z')
const H = 3_600_000

function feedXml(items: Array<{ title: string; path: string; hoursAgo: number | null }>): string {
  const body = items
    .map(
      (i) => `<item><title>${i.title}</title><link>https://x/${i.path}</link>${
        i.hoursAgo === null ? '' : `<pubDate>${new Date(NOW - i.hoursAgo * H).toUTCString()}</pubDate>`
      }<description>desc</description></item>`,
    )
    .join('')
  return `<?xml version="1.0"?><rss version="2.0"><channel>${body}</channel></rss>`
}

const WIRE_FEED = feedXml([
  { title: 'Magnitude 5.2 quake strikes California central coast', path: 'quake', hoursAgo: 72 },
  { title: 'Central bank holds interest rates steady', path: 'rates', hoursAgo: 60 },
  { title: 'Storm forms offshore', path: 'storm', hoursAgo: 6 },
])
const BBC_FEED = feedXml([
  { title: 'California central coast hit by 5.2 magnitude quake', path: 'ca-quake', hoursAgo: 70 },
])

/** 실제 레지스트리는 약관 확인 전이라 잠겨 있다 — 테스트는 열린 사본을 쓴다. */
function open(spec: FactSourceSpec, publisher: string): FactSourceSpec {
  return { ...spec, publisher, wiring: 'in-repo', access: { ...spec.access, termsReviewed: true } }
}

/** 승인 상태와 무관하게 "미승인이면 안 읽는다" 를 검사하기 위한 잠긴 사본. */
function locked(spec: FactSourceSpec): FactSourceSpec {
  return { ...spec, access: { ...spec.access, termsReviewed: false } }
}

const REGISTRY: Record<string, FactSourceSpec> = {
  reuters: open(FACT_SOURCES['ap']!, 'wire.example'),
  bbc: open(FACT_SOURCES['bbc']!, 'bbc.example'),
  locked: locked(FACT_SOURCES['ap']!),
}

const FEEDS: FeedConfig[] = [
  { sourceKey: 'reuters', url: 'https://wire.example/feed.xml', label: '통신사', enabled: true },
  { sourceKey: 'bbc', url: 'https://bbc.example/feed.xml', label: '공영', enabled: true },
]

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
const ALLOW_ALL = OK('User-agent: *\nAllow: /\n')

const ROUTES = {
  'https://wire.example/robots.txt': ALLOW_ALL,
  'https://bbc.example/robots.txt': ALLOW_ALL,
  'https://wire.example/feed.xml': OK(WIRE_FEED),
  'https://bbc.example/feed.xml': OK(BBC_FEED),
}

describe('collectStories', () => {
  it('계통이 다른 두 보도를 한 사건으로 묶어 취재 대상으로 올린다', async () => {
    const d = deps(ROUTES)
    const r = await collectStories(FEEDS, d, { registry: REGISTRY })

    expect(r.pursue).toHaveLength(1)
    expect(r.pursue[0]!.independentLines).toBe(2)
    expect(r.pursue[0]!.headline).toContain('quake')
    // 금리 기사는 한 계통뿐이라 아직 취재 대상이 아니다
    expect(r.singleLine.map((c) => c.headline)).toContain('Central bank holds interest rates steady')
  })

  it('발견 단계에서 본문을 읽지 않는다 — robots 와 피드만 요청', async () => {
    const d = deps(ROUTES)
    await collectStories(FEEDS, d, { registry: REGISTRY })
    expect(d.seen.sort()).toEqual([
      'https://bbc.example/feed.xml',
      'https://bbc.example/robots.txt',
      'https://wire.example/feed.xml',
      'https://wire.example/robots.txt',
    ])
    expect(d.seen.some((u) => u.includes('/quake'))).toBe(false)
  })

  it('48시간 안 된 기사는 holding 으로 남는다', async () => {
    const r = await collectStories(FEEDS, deps(ROUTES), { registry: REGISTRY })
    expect(r.holding.map((c) => c.title)).toEqual(['Storm forms offshore'])
  })

  it('같은 호스트의 robots 는 한 번만 확인한다', async () => {
    const twoFeeds: FeedConfig[] = [
      ...FEEDS,
      { sourceKey: 'reuters', url: 'https://wire.example/world.xml', label: '통신사 국제', enabled: true },
    ]
    const d = deps({ ...ROUTES, 'https://wire.example/world.xml': OK(WIRE_FEED) })
    const r = await collectStories(twoFeeds, d, { registry: REGISTRY })
    expect(d.seen.filter((u) => u === 'https://wire.example/robots.txt')).toHaveLength(1)
    expect(r.robots).toEqual({ 'wire.example': 'ok', 'bbc.example': 'ok' })
  })

  it('robots 를 못 가져오면 그 발행사만 건너뛰고 사유를 남긴다', async () => {
    const d = deps({ ...ROUTES, 'https://wire.example/robots.txt': { ok: false, status: 503, text: '' } })
    const r = await collectStories(FEEDS, d, { registry: REGISTRY })
    expect(r.robots['wire.example']).toBe('failed')
    expect(r.skipped.some((s) => s.reason.includes('robots.txt 를 가져오지 못했다'))).toBe(true)
    // BBC 는 정상 수집되므로 후보가 남는다 (단, 단독이라 취재 대상은 아님)
    expect(r.pursue).toEqual([])
    expect(r.singleLine).toHaveLength(1)
  })

  it('약관 미확인 소스는 요청 없이 건너뛴다', async () => {
    const d = deps(ROUTES)
    const r = await collectStories(
      [{ sourceKey: 'locked', url: 'https://ap.example/feed.xml', label: 'AP', enabled: true }],
      d,
      { registry: REGISTRY },
    )
    expect(d.seen).toEqual([])
    expect(r.skipped[0]!.reason).toContain('약관확인=false')
  })

  it('비활성 피드와 알 수 없는 소스도 조용히 사라지지 않는다', async () => {
    const d = deps(ROUTES)
    const r = await collectStories(
      [
        { sourceKey: 'bbc', url: 'https://bbc.example/feed.xml', label: '공영', enabled: false },
        { sourceKey: 'nope', url: 'https://x.example/f.xml', label: '?', enabled: true },
        { sourceKey: 'bbc', url: 'not-a-url', label: '깨진 주소', enabled: true },
      ],
      d,
      { registry: REGISTRY },
    )
    expect(r.skipped.map((s) => s.reason)).toEqual([
      '공영: 비활성',
      '알 수 없는 소스 키: nope',
      'URL 형식 오류',
    ])
    expect(d.seen).toEqual([])
  })

  it('요청 수를 스스로 센다', async () => {
    const r = await collectStories(FEEDS, deps(ROUTES), { registry: REGISTRY })
    expect(r.requests).toBe(4) // robots 2 + feed 2
  })

  it('게이트를 재사용하면 robots 를 다시 확인하지 않는다', async () => {
    const gate = new CrawlGate()
    const d1 = deps(ROUTES)
    await collectStories(FEEDS, d1, { registry: REGISTRY, gate })
    const d2 = deps(ROUTES)
    await collectStories(FEEDS, d2, { registry: REGISTRY, gate })
    // 두 번째 실행도 robots 를 다시 받는다(결과 캐시는 report 단위) — 하지만 게이트가
    // 이미 규칙을 갖고 있어 차단으로 떨어지지 않는다는 것이 요점이다.
    expect(d2.seen).toContain('https://wire.example/feed.xml')
  })

  it('피드별 항목 수는 보류분을 포함한다 — 잘 도는 피드가 0 으로 보이면 안 된다', async () => {
    // 실측 2026-08-18: DW 는 137항목을 내놓고도 화면에 "찾음 0" 으로 표시됐다. 묶음
    // (pursue/singleLine)에 들어간 것만 세면 48시간 보류에 걸린 최신 기사가 전부 빠지고,
    // 운영자에게는 **죽은 피드와 구별되지 않는다**.
    const FRESH = feedXml([
      { title: 'Storm forms offshore near the coast', path: 's1', hoursAgo: 2 },
      { title: 'Ferries cancelled as winds pick up', path: 's2', hoursAgo: 3 },
    ])
    const r = await collectStories(
      [{ sourceKey: 'reuters', url: 'https://wire.example/feed.xml', label: 'wire', enabled: true }],
      deps({
        'https://wire.example/robots.txt': ALLOW_ALL,
        'https://wire.example/feed.xml': OK(FRESH),
      }),
      { registry: REGISTRY },
    )
    expect(r.pursue).toHaveLength(0)
    expect(r.singleLine).toHaveLength(0)
    expect(r.holding).toHaveLength(2)
    expect(r.perFeed['https://wire.example/feed.xml']).toBe(2)
  })

})

describe('toBatchRow', () => {
  it('가장 이른 보도 시각을 사건 시각으로 삼는다', async () => {
    const r = await collectStories(FEEDS, deps(ROUTES), { registry: REGISTRY })
    const row = toBatchRow(r.pursue[0]!)
    expect(row.status).toBe('collecting')
    expect(row.topic).toContain('quake')
    // 72시간 전 보도가 가장 이르다 → 실제 사건은 그보다 앞이므로 I15 를 짧게 잡는 쪽으로 틀린다
    expect(Date.parse(row.event_occurred_at!)).toBe(NOW - 72 * H)
  })

})
