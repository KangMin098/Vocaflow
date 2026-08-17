// packages/library-pipeline/src/compose/feed-discovery.ts
//
// ACP §20 재저작 — 피드 자동 발견.
//
// 왜 만들었나: 초판 피드 등록 화면은 관리자가 **피드 주소를 직접 찾아 붙여 넣는** 방식이었다.
// 그건 운영자에게 "발행사 사이트를 뒤져 RSS 링크를 찾아오라"는 숙제를 떠넘긴 것이고,
// 주소가 바뀌면 조용히 0건이 되는데 왜인지도 알 수 없다.
//
// 발행사는 대부분 배포를 의도해 피드를 **스스로 알린다**:
//   ① 표준 autodiscovery — 홈페이지 <head> 의 <link rel="alternate" type="application/rss+xml">
//   ② 관습 경로 — /rss · /feed · /rss.xml …  (①이 없을 때만 최소 횟수로 시도)
//
// 그래서 관리자는 **발행사만 고르면 되고**, 화면은 찾아낸 피드 목록에서 고르게 한다.
// 주소를 아는 것은 시스템의 일이지 사람의 일이 아니다.
//
// 접근 규율은 그대로다 — robots 를 먼저 확인하고, 간격을 지키고, 본문은 남기지 않는다.

import { parseRssFeed } from '../ingest-article/_helpers'
import { CrawlGate } from './access'
import { primeRobots, type FetchDeps, type FetchResult } from './news-feed'
import { COMPOSE_USER_AGENT } from './access'
import { isCollectable, type FactSourceSpec } from './sources'

/** 발견된 피드 후보. */
export interface DiscoveredFeed {
  url: string
  /** 피드가 스스로 밝힌 제목 (autodiscovery 의 title 또는 피드 <title>) */
  title: string | null
  /** 어떻게 찾았는가 — 관습 경로는 발행사가 알린 것이 아니므로 구분해 둔다. */
  via: 'autodiscovery' | 'convention'
  /** 실제로 열어 보고 항목이 있는 피드임을 확인했는가 */
  verified: boolean
  /** 확인 시 파싱된 항목 수 */
  itemCount: number
}

export interface DiscoverFeedsResult {
  feeds: DiscoveredFeed[]
  /** 시도했으나 쓸 수 없던 것 — 사유를 남긴다(조용한 빈 목록 금지) */
  skipped: Array<{ url: string; reason: string }>
  /** 보낸 요청 수 — 발행사 서버에 얼마나 물었는지 스스로 계측한다 */
  requests: number
}

/**
 * `<link rel="alternate">` 로 알려진 피드만 추출.
 *
 * rel 에 alternate 가 있고 type 이 RSS/Atom 계열인 것만 받는다. `rel="feed"` 만 있는
 * 비표준 표기도 흔해서 함께 받되, 그 외의 alternate(다국어 페이지 등)는 피드가 아니다.
 */
export function parseFeedLinks(
  html: string,
  baseUrl: string,
): Array<{ url: string; title: string | null }> {
  const out: Array<{ url: string; title: string | null }> = []
  const seen = new Set<string>()
  const linkTag = /<link\b[^>]*>/gi
  let m: RegExpExecArray | null

  while ((m = linkTag.exec(html)) !== null) {
    const tag = m[0]!
    const attr = (name: string): string | null => {
      const a = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
      return a ? (a[2] ?? a[3] ?? a[4] ?? null) : null
    }
    const rel = (attr('rel') ?? '').toLowerCase()
    const type = (attr('type') ?? '').toLowerCase()
    const href = attr('href')
    if (!href) continue

    const isFeedType = /application\/(rss|atom)\+xml|application\/feed\+json/.test(type)
    const relOk = /\b(alternate|feed)\b/.test(rel)
    if (!relOk || !isFeedType) continue

    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      continue
    }
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push({ url: abs, title: attr('title') })
  }
  return out
}

/**
 * 관습 경로 — autodiscovery 가 없을 때만 쓴다.
 *
 * 순서는 적중률순이다. 발행사 서버에 헛되이 묻는 횟수를 줄이려고 짧게 유지한다 —
 * 목록을 늘리면 발견율보다 부하가 먼저 는다.
 */
export const FEED_CONVENTIONS: ReadonlyArray<string> = [
  '/rss',
  '/feed',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
]

/** 응답이 실제로 피드인지 — 항목이 하나라도 파싱되면 피드로 본다. */
export function looksLikeFeed(text: string): { ok: boolean; itemCount: number; title: string | null } {
  const items = parseRssFeed(text)
  if (items.length === 0) return { ok: false, itemCount: 0, title: null }
  const t = text.match(/<title(?:\s[^>]*)?>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i)
  const title = (t?.[1] ?? t?.[2] ?? '').trim() || null
  return { ok: true, itemCount: items.length, title }
}

function headers(): Record<string, string> {
  return { 'User-Agent': COMPOSE_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml' }
}

/** 게이트를 지키며 한 번 가져온다. 차단·실패는 사유로 돌려준다. */
async function guardedFetch(
  url: string,
  gate: CrawlGate,
  deps: FetchDeps,
): Promise<{ res: FetchResult } | { reason: string }> {
  const decision = gate.check(url, deps.now())
  if (!decision.allowed) return { reason: decision.reason! }
  if (decision.waitMs > 0) await deps.sleep(decision.waitMs)
  try {
    gate.markFetched(url, deps.now())
    const res = await deps.fetchText(url, headers())
    if (res.status === 403) {
      return { reason: '우리 수집기를 거절했습니다(403). 우회하지 않습니다.' }
    }
    if (!res.ok) return { reason: `응답 ${res.status}` }
    return { res }
  } catch (e) {
    return { reason: `요청 실패: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export interface DiscoverFeedsOptions {
  /** 관습 경로까지 시도할지. autodiscovery 로 충분하면 끄는 편이 예의다. */
  tryConventions?: boolean
  /** 확인할 후보 상한 — 발행사가 피드를 수십 개 알리는 경우가 있다. */
  maxCandidates?: number
}

/**
 * 발행사 하나의 피드를 찾아 확인까지 마친다.
 *
 * 관리자는 이 결과를 목록에서 고르기만 하면 된다 — 주소를 찾아 오지 않는다.
 */
export async function discoverFeeds(
  spec: FactSourceSpec,
  gate: CrawlGate,
  deps: FetchDeps,
  opts: DiscoverFeedsOptions = {},
): Promise<DiscoverFeedsResult> {
  const maxCandidates = opts.maxCandidates ?? 8
  const skipped: Array<{ url: string; reason: string }> = []
  let requests = 0

  const home = `https://${spec.publisher}/`
  if (!isCollectable(spec)) {
    return {
      feeds: [],
      skipped: [{ url: home, reason: `${spec.key}: 이용약관 확인 전에는 조회하지 않습니다` }],
      requests: 0,
    }
  }

  // robots 를 먼저 본다 — 발견도 수집이다.
  const robots = await primeRobots(spec.publisher, gate, deps)
  requests++
  if (robots === 'failed') {
    return {
      feeds: [],
      skipped: [{ url: home, reason: 'robots.txt 를 가져오지 못했습니다 — 조회를 보류합니다' }],
      requests,
    }
  }

  // ① autodiscovery
  const candidates: Array<{ url: string; title: string | null; via: DiscoveredFeed['via'] }> = []
  const homeRes = await guardedFetch(home, gate, deps)
  requests++
  if ('reason' in homeRes) {
    skipped.push({ url: home, reason: homeRes.reason })
  } else {
    for (const link of parseFeedLinks(homeRes.res.text, home)) {
      candidates.push({ ...link, via: 'autodiscovery' })
    }
  }

  // ② 관습 경로 — ①이 아무것도 못 찾았을 때만
  if (candidates.length === 0 && (opts.tryConventions ?? true)) {
    for (const path of FEED_CONVENTIONS) {
      candidates.push({ url: `https://${spec.publisher}${path}`, title: null, via: 'convention' })
    }
  }

  // ③ 실제로 열어 확인 — 목록에 "아마 될 것" 을 올리지 않는다
  const feeds: DiscoveredFeed[] = []
  for (const cand of candidates.slice(0, maxCandidates)) {
    const r = await guardedFetch(cand.url, gate, deps)
    requests++
    if ('reason' in r) {
      skipped.push({ url: cand.url, reason: r.reason })
      continue
    }
    const check = looksLikeFeed(r.res.text)
    if (!check.ok) {
      skipped.push({ url: cand.url, reason: '피드가 아닙니다(항목 0)' })
      continue
    }
    feeds.push({
      url: cand.url,
      title: cand.title ?? check.title,
      via: cand.via,
      verified: true,
      itemCount: check.itemCount,
    })
  }

  // 발행사가 스스로 알린 것을 먼저, 그다음 항목이 많은 것.
  feeds.sort(
    (a, b) =>
      (a.via === b.via ? 0 : a.via === 'autodiscovery' ? -1 : 1) || b.itemCount - a.itemCount,
  )

  return { feeds, skipped, requests }
}
