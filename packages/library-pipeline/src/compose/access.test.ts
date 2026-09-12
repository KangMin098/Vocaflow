// packages/library-pipeline/src/compose/access.test.ts
// ACP §20 — 접근 규율 회귀.
//
// 지키는 것: 상업 뉴스를 읽는 절차가 **기본값 차단**이라는 것.
// 미확인·실패·금지 경로는 전부 막히고, 통과한 경우에만 간격을 두고 읽는다.

import { describe, expect, it } from 'vitest'

import {
  COMPOSE_USER_AGENT,
  CrawlGate,
  groupFor,
  isPathAllowed,
  parseRobots,
  readForFacts,
} from './access'

const ROBOTS = `
# 예시 발행사 robots.txt
User-agent: *
Disallow: /premium/
Disallow: /search
Allow: /premium/free-sample
Crawl-delay: 5

User-agent: BadBot
Disallow: /
`

describe('parseRobots', () => {
  it('그룹·규칙·Crawl-delay 를 읽는다', () => {
    const r = parseRobots(ROBOTS)
    expect(r.groups).toHaveLength(2)
    const star = groupFor(r, COMPOSE_USER_AGENT)!
    expect(star.agents).toContain('*')
    expect(star.crawlDelay).toBe(5)
    expect(star.rules).toHaveLength(3)
  })

  it('주석과 빈 줄을 무시하고, 빈 Disallow 는 규칙이 아니다', () => {
    const r = parseRobots('User-agent: *\n# comment\n\nDisallow:\n')
    expect(groupFor(r, 'x')!.rules).toEqual([])
  })

  it('연속된 User-agent 는 한 그룹을 공유한다', () => {
    const r = parseRobots('User-agent: a\nUser-agent: b\nDisallow: /x\n')
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0]!.agents).toEqual(['a', 'b'])
  })
})

describe('isPathAllowed', () => {
  const r = parseRobots(ROBOTS)

  it('금지 경로를 막는다', () => {
    expect(isPathAllowed(r, COMPOSE_USER_AGENT, '/premium/story-1')).toBe(false)
    expect(isPathAllowed(r, COMPOSE_USER_AGENT, '/search?q=a')).toBe(false)
  })

  it('더 긴 Allow 가 짧은 Disallow 를 이긴다', () => {
    expect(isPathAllowed(r, COMPOSE_USER_AGENT, '/premium/free-sample')).toBe(true)
  })

  it('규칙 없는 경로는 허용', () => {
    expect(isPathAllowed(r, COMPOSE_USER_AGENT, '/world/2026/08/quake')).toBe(true)
  })

  it('우리 UA 를 지목한 그룹이 있으면 그쪽이 우선한다', () => {
    const named = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: VocaflowFactBot\nDisallow: /\n')
    expect(isPathAllowed(named, COMPOSE_USER_AGENT, '/anything')).toBe(false)
    expect(isPathAllowed(named, 'SomeOtherBot', '/anything')).toBe(true)
  })

  it('$ 는 끝 고정, * 는 와일드카드', () => {
    const r2 = parseRobots('User-agent: *\nDisallow: /*.pdf$\n')
    expect(isPathAllowed(r2, 'x', '/docs/a.pdf')).toBe(false)
    expect(isPathAllowed(r2, 'x', '/docs/a.pdf?x=1')).toBe(true)
  })
})

describe('CrawlGate — 기본값은 차단', () => {
  const T0 = 1_700_000_000_000

  it('robots 미등록 호스트는 읽지 않는다', () => {
    const g = new CrawlGate()
    const d = g.check('https://news.example/world/a', T0)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('robots.txt 미확인')
  })

  it('robots 를 가져오지 못한 것을 허용으로 해석하지 않는다', () => {
    const g = new CrawlGate()
    g.setRobots('news.example', null)
    const d = g.check('https://news.example/world/a', T0)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('가져오지 못했다')
  })

  it('허용 경로는 통과하고 Crawl-delay 를 간격으로 삼는다', () => {
    const g = new CrawlGate()
    g.setRobots('news.example', parseRobots(ROBOTS))
    const d = g.check('https://news.example/world/a', T0)
    expect(d.allowed).toBe(true)
    expect(d.intervalMs).toBe(5_000) // Crawl-delay 5s > 기본 2s
    expect(d.waitMs).toBe(0)
  })

  it('직전 요청 이후 간격이 안 찼으면 남은 시간을 알려 준다', () => {
    const g = new CrawlGate()
    g.setRobots('news.example', parseRobots(ROBOTS))
    g.markFetched('https://news.example/world/a', T0)
    expect(g.check('https://news.example/world/b', T0 + 1_000).waitMs).toBe(4_000)
    expect(g.check('https://news.example/world/b', T0 + 6_000).waitMs).toBe(0)
  })

  it('간격은 호스트별로 따로 센다', () => {
    const g = new CrawlGate()
    g.setRobots('a.example', parseRobots('User-agent: *\nAllow: /\n'))
    g.setRobots('b.example', parseRobots('User-agent: *\nAllow: /\n'))
    g.markFetched('https://a.example/x', T0)
    expect(g.check('https://b.example/x', T0).waitMs).toBe(0)
  })

  it('금지 경로는 간격과 무관하게 막힌다', () => {
    const g = new CrawlGate()
    g.setRobots('news.example', parseRobots(ROBOTS))
    const d = g.check('https://news.example/premium/story-1', T0)
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('robots.txt 가')
  })

  it('UA 로 우리를 밝힌다 (익명 위장 금지)', () => {
    expect(COMPOSE_USER_AGENT).toContain('Vocaflow')
    expect(COMPOSE_USER_AGENT).toContain('+http')
  })
})

describe('readForFacts — 본문 비보관이 시그니처로 강제된다', () => {
  const BODY =
    'A magnitude 5.2 earthquake struck the central coast on Tuesday morning, and officials said three people were hurt.'

  it('지문과 추출 결과만 돌려주고 본문은 돌려주지 않는다', async () => {
    const read = await readForFacts(
      async () => BODY,
      // 실제 파이프라인에서는 사실 카드가 나온다. 여기서는 "본문을 본 흔적"만 세면 충분하다.
      (body) => ({ injured: /three people were hurt/.test(body) ? 3 : 0 }),
    )
    expect(read.extracted.injured).toBe(3)
    expect(read.fingerprint.hashes.length).toBeGreaterThan(0)
    // 반환값 어디에도 원문이 없다
    expect(JSON.stringify(read)).not.toContain('earthquake')
    expect(Object.keys(read).sort()).toEqual(['extracted', 'fingerprint', 'readAt'])
  })

  it('지문은 이후 표현 대조에 그대로 쓰인다', async () => {
    const read = await readForFacts(
      async () => BODY,
      () => null,
    )
    expect(read.fingerprint.n).toBe(7)
    expect(read.fingerprint.tokenCount).toBeGreaterThan(15)
  })
})
