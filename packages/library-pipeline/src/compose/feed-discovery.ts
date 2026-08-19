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
import { isFeedCollectable, type FactSourceSpec } from './sources'

// ── 실패 분류 ────────────────────────────────────────────────────────
//
// 실패를 한 덩어리 문자열로 돌려주면 운영자는 "안 되네" 까지만 알고 멈춘다.
// 무엇이 막았는지에 따라 **다음에 할 일이 완전히 다르므로** 유형으로 나눈다.

export type FeedFailureKind =
  /** 이용약관 확인 전 — 사람이 결정할 일 */
  | 'terms-unreviewed'
  /** robots.txt 를 못 가져옴 — 일시적일 수 있다 */
  | 'robots-unavailable'
  /** robots.txt 가 그 경로를 금지 — 발행사의 명시적 거절 */
  | 'robots-disallow'
  /** 403 — 우리 수집기를 거절. 우회하지 않는다 */
  | 'refused'
  /** 404 — 그 주소에 아무것도 없다. 경로가 바뀌었을 수 있다 */
  | 'not-found'
  /** 열렸지만 피드가 아니다(대개 HTML 페이지) */
  | 'not-a-feed'
  /** 형식은 멀쩡한데 내용이 낡았다 — 옮겨 간 주소의 잔해 */
  | 'stale-feed'
  /** 네트워크 오류·타임아웃 */
  | 'network'
  /** 그 외 HTTP 오류 */
  | 'http-error'

/** 유형별로 운영자가 다음에 할 일. 화면이 이 문장을 그대로 보여 준다. */
export const FEED_FAILURE_ACTION: Record<FeedFailureKind, string> = {
  'terms-unreviewed': '이 발행사를 쓰기로 결정한 뒤 소스 승인을 올린다.',
  'robots-unavailable':
    '일시적 장애일 수 있다. 잠시 뒤 다시 시도하고, 반복되면 그 발행사는 보류한다.',
  'robots-disallow':
    '발행사가 그 경로를 명시적으로 막았다. 다른 피드 경로를 시도하거나 이 발행사를 뺀다.',
  refused:
    '우리 수집기를 거절했다. 브라우저인 척 우회하지 않는다 — 이 발행사는 목록에서 빼는 것이 맞다.',
  'not-found': '주소가 바뀌었을 수 있다. 발행사 RSS 안내 페이지의 주소를 직접 넣어 확인해 본다.',
  'not-a-feed': '피드가 아니라 일반 페이지다. 그 페이지에 링크된 실제 피드 주소를 넣어 본다.',
  'stale-feed':
    '주소는 살아 있지만 발행사가 피드를 옮겼다. 발행사 RSS 안내에서 현재 주소를 찾아 넣는다.',
  network: '연결이 실패했다. 잠시 뒤 다시 시도한다.',
  'http-error': '발행사 서버가 오류를 냈다. 잠시 뒤 다시 시도한다.',
}

export interface FeedSkip {
  url: string
  kind: FeedFailureKind
  reason: string
  /** 이 실패에 대해 다음에 할 일 */
  nextAction: string
}

function skip(url: string, kind: FeedFailureKind, reason: string): FeedSkip {
  return { url, kind, reason, nextAction: FEED_FAILURE_ACTION[kind] }
}

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
  /** 시도했으나 쓸 수 없던 것 — 유형·사유·다음 행동을 함께 남긴다(조용한 빈 목록 금지) */
  skipped: FeedSkip[]
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
/**
 * 피드가 살아 있다고 볼 최대 경과일.
 *
 * 왜 필요한가: HTTP 200 + 항목 파싱 + 발행시각 존재를 모두 통과하고도 **죽은 피드**가 있다.
 * 실측 2026-08-18 — cnn.com/rss/edition_world.rss 는 10항목을 정상적으로 내놓았지만 전부
 * **2012년** 기사였다. 발행사가 피드를 옮기면서 옛 주소에 잔해가 남은 것이다. 형식만 보면
 * 통과하므로 화면에는 정상 등록으로 보이고, 그 소스는 영원히 아무것도 기여하지 않는다.
 */
export const FEED_MAX_AGE_DAYS = 30

export function looksLikeFeed(text: string): {
  ok: boolean
  itemCount: number
  title: string | null
  /** 가장 최근 항목의 경과일. 발행시각이 하나도 없으면 null */
  newestAgeDays: number | null
} {
  const items = parseRssFeed(text)
  if (items.length === 0) return { ok: false, itemCount: 0, title: null, newestAgeDays: null }
  const t = text.match(/<title(?:\s[^>]*)?>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i)
  const title = (t?.[1] ?? t?.[2] ?? '').trim() || null
  let newest = -Infinity
  for (const it of items) {
    const ts = it.published_at ? Date.parse(it.published_at) : NaN
    if (!Number.isNaN(ts) && ts > newest) newest = ts
  }
  const newestAgeDays =
    newest === -Infinity ? null : Math.floor((Date.now() - newest) / 86_400_000)
  return { ok: true, itemCount: items.length, title, newestAgeDays }
}

function headers(): Record<string, string> {
  return { 'User-Agent': COMPOSE_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml' }
}

/** 게이트를 지키며 한 번 가져온다. 차단·실패는 **유형과 함께** 돌려준다. */
async function guardedFetch(
  url: string,
  gate: CrawlGate,
  deps: FetchDeps,
): Promise<{ res: FetchResult } | { fail: FeedSkip }> {
  const decision = gate.check(url, deps.now())
  if (!decision.allowed) {
    const kind: FeedFailureKind = decision.reason!.includes('robots.txt 가')
      ? 'robots-disallow'
      : 'robots-unavailable'
    return { fail: skip(url, kind, decision.reason!) }
  }
  if (decision.waitMs > 0) await deps.sleep(decision.waitMs)
  try {
    gate.markFetched(url, deps.now())
    const res = await deps.fetchText(url, headers())
    if (res.status === 403) {
      return { fail: skip(url, 'refused', '우리 수집기를 거절했습니다(403)') }
    }
    if (res.status === 404) return { fail: skip(url, 'not-found', '그 주소에 아무것도 없습니다(404)') }
    if (!res.ok) return { fail: skip(url, 'http-error', `응답 ${res.status}`) }
    return { res }
  } catch (e) {
    return {
      fail: skip(url, 'network', `요청 실패: ${e instanceof Error ? e.message : String(e)}`),
    }
  }
}

/**
 * 피드 안내 페이지에서 링크를 줍는다.
 *
 * 발행사는 `<link rel="alternate">` 로 알리는 대신 **"RSS 안내" 페이지에 목록을 두는** 경우가
 * 많다. 그 페이지의 `<a href>` 중 피드처럼 보이는 것을 후보로 삼는다 — 어차피 열어서
 * 확인하므로 잘못 주워도 목록에 오르지 않는다.
 */
export function parseFeedAnchors(html: string, baseUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const anchor = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = anchor.exec(html)) !== null) {
    const href = m[2] ?? m[3] ?? m[4]
    if (!href) continue
    // 확장자나 경로에 피드 냄새가 나는 것만
    if (!/(\.xml|\.rss|\.atom|[/?&](rss|feed|atom)\b)/i.test(href)) continue
    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      continue
    }
    if (seen.has(abs)) continue
    seen.add(abs)
    out.push(abs)
  }
  return out
}

/**
 * 주소 하나를 열어 피드인지 확인한다 — 자동 발견이 실패했을 때의 백스톱.
 *
 * 자동 발견이 **기본 경로**이고 이것은 **대안**이다. 발행사가 홈에서 수집기를 막거나
 * 피드 경로가 특이해 못 찾는 경우가 있는데, 그때 운영자가 발행사 안내 페이지에서 본 주소를
 * 넣을 길까지 막으면 파이프라인 전체가 멈춘다. 다만 **검증은 자동 발견과 똑같이** 한다 —
 * robots 를 보고, 간격을 지키고, 열어서 항목이 파싱되는지 확인한다.
 */
export async function verifyFeedUrl(
  spec: FactSourceSpec,
  url: string,
  gate: CrawlGate,
  deps: FetchDeps,
): Promise<{ feed: DiscoveredFeed } | { fail: FeedSkip }> {
  if (!isFeedCollectable(spec)) {
    return {
      fail: skip(url, 'terms-unreviewed', `${spec.key}: 이용약관 확인 전에는 조회하지 않습니다`),
    }
  }
  let host: string
  try {
    host = new URL(url).host.toLowerCase()
  } catch {
    return { fail: skip(url, 'http-error', '주소 형식이 올바르지 않습니다') }
  }
  const robots = await primeRobots(host, gate, deps)
  if (robots === 'failed') {
    return { fail: skip(url, 'robots-unavailable', 'robots.txt 를 가져오지 못했습니다') }
  }
  const r = await guardedFetch(url, gate, deps)
  if ('fail' in r) return r
  const check = looksLikeFeed(r.res.text)
  if (!check.ok) return { fail: skip(url, 'not-a-feed', '열렸지만 피드가 아닙니다(항목 0)') }
  if (check.newestAgeDays !== null && check.newestAgeDays > FEED_MAX_AGE_DAYS) {
    return {
      fail: skip(
        url,
        'stale-feed',
        `형식은 피드가 맞지만 가장 최근 항목이 ${check.newestAgeDays}일 전입니다`,
      ),
    }
  }
  return {
    feed: { url, title: check.title, via: 'convention', verified: true, itemCount: check.itemCount },
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
  const skipped: FeedSkip[] = []
  let requests = 0

  const apex = spec.publisher.toLowerCase()
  // 대형 발행사는 robots·피드를 www 호스트에서만 서비스하는 경우가 흔하다.
  // apex 만 보면 "robots 를 못 가져왔다" 로 끝나 발견 자체가 안 된다.
  const hosts = apex.startsWith('www.') ? [apex] : [apex, `www.${apex}`]
  const home = `https://${apex}/`

  if (!isFeedCollectable(spec)) {
    return {
      feeds: [],
      skipped: [skip(home, 'terms-unreviewed', `${spec.key}: 이용약관 확인 전에는 조회하지 않습니다`)],
      requests: 0,
    }
  }

  // robots 를 먼저 본다 — 발견도 수집이다. 두 호스트 모두 등록해야 힌트 주소(www)가 통과한다.
  const robotsByHost: Record<string, string> = {}
  let anyRobots = false
  for (const host of hosts) {
    const r = await primeRobots(host, gate, deps)
    requests++
    robotsByHost[host] = r
    if (r !== 'failed') anyRobots = true
  }
  // 발행사 도메인의 robots 를 못 읽어도 **다른 호스트의 피드까지 포기하지는 않는다**.
  // robots 는 우리가 실제로 읽는 호스트의 것을 보면 되고, 그 확인은 아래 verify() 가 한다.
  // (2026-08-18 실측: npr.org robots 는 안 열리는데 feeds.npr.org 피드는 정상이었다.)
  const absoluteHints = (spec.feedHints ?? []).filter((h) => h.startsWith('http'))
  if (!anyRobots && absoluteHints.length === 0) {
    return {
      feeds: [],
      skipped: hosts.map((h) =>
        skip(
          `https://${h}/robots.txt`,
          'robots-unavailable',
          'robots.txt 를 가져오지 못했습니다 — 확인 전에는 조회하지 않습니다',
        ),
      ),
      requests,
    }
  }
  // robots 를 읽은 호스트를 기본 호스트로 삼는다(대개 www).
  const primary = hosts.find((h) => robotsByHost[h] !== 'failed') ?? apex

  // ① autodiscovery — 홈페이지가 막혀도 여기서 끝내지 않는다.
  const candidates: Array<{ url: string; title: string | null; via: DiscoveredFeed['via'] }> = []
  const homeUrl = `https://${primary}/`
  const homeRes = anyRobots
    ? await guardedFetch(homeUrl, gate, deps)
    : { fail: skip(homeUrl, 'robots-unavailable', 'robots.txt 를 못 읽어 홈페이지는 건너뜁니다') }
  if (anyRobots) requests++
  if ('fail' in homeRes) {
    skipped.push({ ...homeRes.fail, reason: `홈페이지를 읽지 못했습니다 — ${homeRes.fail.reason}` })
  } else {
    for (const link of parseFeedLinks(homeRes.res.text, homeUrl)) {
      candidates.push({ ...link, via: 'autodiscovery' })
    }
    // 같은 페이지의 링크에서 피드처럼 보이는 것도 **항상** 줍는다.
    //
    // ⚠️ 예전에는 `알림이 하나도 없을 때만` 주웠다. 그런데 거의 모든 발행사가 "전체 뉴스"
    //   피드 하나는 `<link rel="alternate">` 로 알린다 — 그 하나가 있으면 섹션 피드 목록을
    //   영영 안 보게 된다. 실측 2026-08-19: 코리아헤럴드는 알림이 `newsAll` 하나뿐이지만
    //   `/rss` 안내 페이지에 **섹션 8개**(kh_LifenCulture · kh_Sports · kh_Kpop …)를
    //   적어 두고 있었고, 우리는 사흘 동안 전체 피드 하나만 쓰고 있었다. 그 8개는
    //   `kh_` 접두사라 관습 경로 추측으로는 절대 찾을 수 없다 — 발행사가 적어 둔 것을
    //   읽는 길 말고는 방법이 없다.
    for (const url of parseFeedAnchors(homeRes.res.text, homeUrl)) {
      if (!candidates.some((c) => c.url === url)) {
        candidates.push({ url, title: null, via: 'convention' })
      }
    }
  }

  /** 힌트를 후보로 — 절대주소면 그대로, 경로면 기본 호스트에 붙인다. */
  const hintCandidates = (): typeof candidates =>
    (spec.feedHints ?? []).map((h) => ({
      url: h.startsWith('http') ? h : `https://${primary}${h}`,
      title: null,
      via: 'convention' as const,
    }))

  // ② 알려진 피드 경로 — 홈페이지가 자동 수집기를 막아도 피드는 배포용이라 열리는 일이 흔하다.
  if (candidates.length === 0) candidates.push(...hintCandidates())

  // ③ 일반 관습 경로 — 위 둘이 모두 비었을 때만
  if (candidates.length === 0 && (opts.tryConventions ?? true)) {
    for (const path of FEED_CONVENTIONS) {
      candidates.push({ url: `https://${primary}${path}`, title: null, via: 'convention' })
    }
  }

  /**
   * 후보를 실제로 열어 확인한다. 목록에 "아마 될 것" 을 올리지 않는다.
   *
   * 후보가 **다른 호스트**에 있으면 그 호스트의 robots 를 먼저 확인한다 —
   * 발행사가 피드를 별도 호스트(feed.·rss.·feeds.)에 두는 일이 흔한데, 안 그러면
   * "robots 미확인" 으로 전부 버려진다(2026-08-18 실측에서 Korea Times 가 이 경우였다).
   */
  const primed = new Set(hosts)
  /** 안내 페이지에서 새로 주운 주소 — 확인은 한 단계만 더 한다(무한히 따라가지 않는다). */
  const harvested: typeof candidates = []
  const verify = async (list: typeof candidates): Promise<DiscoveredFeed[]> => {
    const out: DiscoveredFeed[] = []
    for (const cand of list.slice(0, maxCandidates)) {
      let candHost: string
      try {
        candHost = new URL(cand.url).host.toLowerCase()
      } catch {
        skipped.push(skip(cand.url, 'http-error', '주소 형식 오류'))
        continue
      }
      if (!primed.has(candHost)) {
        primed.add(candHost)
        const r = await primeRobots(candHost, gate, deps)
        requests++
        if (r === 'failed') {
          skipped.push(
            skip(cand.url, 'robots-unavailable', `${candHost} robots.txt 를 가져오지 못했습니다`),
          )
          continue
        }
      }
      const r = await guardedFetch(cand.url, gate, deps)
      requests++
      if ('fail' in r) {
        skipped.push(r.fail)
        continue
      }
      const check = looksLikeFeed(r.res.text)
      if (!check.ok) {
        // 피드가 아니면 **안내 페이지일 수 있다.** 발행사는 `/rss` 에 섹션 목록만 두는 일이
        //   흔한데(코리아헤럴드 8개), 여기서 그냥 버리면 그 목록을 영영 못 본다.
        //   한 단계만 따라간다 — 주운 주소는 다음 판에서 똑같이 열어 확인하므로,
        //   잘못 주워도 목록에는 오르지 않는다.
        const nested = parseFeedAnchors(r.res.text, cand.url).filter(
          (u) => u !== cand.url && !list.some((c) => c.url === u),
        )
        if (nested.length) harvested.push(...nested.map((u) => ({ url: u, title: null, via: 'convention' as const })))
        skipped.push(
          skip(
            cand.url,
            'not-a-feed',
            nested.length
              ? `열렸지만 피드가 아닙니다 — 안내 페이지로 보고 링크 ${nested.length}개를 확인합니다`
              : '열렸지만 피드가 아닙니다(항목 0)',
          ),
        )
        continue
      }
      out.push({
        url: cand.url,
        title: cand.title ?? check.title,
        via: cand.via,
        verified: true,
        itemCount: check.itemCount,
      })
    }
    return out
  }

  let feeds = await verify(candidates)

  // 안내 페이지를 만났으면 거기 적힌 주소를 한 판 더 확인한다. **한 번만** 한다 —
  //   목록 페이지가 또 목록 페이지를 가리키면 끝없이 따라가게 되고, 그건 발견이 아니라 크롤이다.
  if (harvested.length) {
    const more = harvested.filter((h) => !feeds.some((f) => f.url === h.url))
    harvested.length = 0
    if (more.length) feeds = [...feeds, ...(await verify(more))]
  }

  // ④ 알림을 따라갔는데 전부 실패했으면 힌트로 되돌아간다.
  //    발행사가 **자기 robots 가 막는 피드를 알리는** 경우가 실제로 있다(AP, 2026-08-18 실측).
  //    그때 힌트를 시도조차 안 하면 멀쩡한 다른 경로를 놓친다.
  if (feeds.length === 0 && candidates.every((c) => c.via === 'autodiscovery')) {
    feeds = await verify(hintCandidates())
  }

  // 발행사가 스스로 알린 것을 먼저, 그다음 항목이 많은 것.
  feeds.sort(
    (a, b) =>
      (a.via === b.via ? 0 : a.via === 'autodiscovery' ? -1 : 1) || b.itemCount - a.itemCount,
  )

  return { feeds, skipped, requests }
}
