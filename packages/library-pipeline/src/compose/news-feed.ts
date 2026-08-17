// packages/library-pipeline/src/compose/news-feed.ts
//
// ACP §20 재저작 — 상업 뉴스 수집기.
//
// 이 파일이 하는 일은 둘뿐이다:
//   ① 발견(discover) — 발행사가 배포용으로 내놓은 피드에서 "무엇을 쓸지" 후보를 고른다.
//   ② 읽기(read)     — 후보 1건을 접근 규율(compose/access.ts) 아래에서 읽고
//                      **지문과 추출 결과만** 남긴다. 본문은 반환되지 않는다.
//
// 본문 저장·재배포는 이 파이프라인 어디에도 없다. 사실 카드로 바뀐 뒤 원문은 사라진다.
//
// ⚠ 이 수집기는 **자기를 밝힌다**. 기존 VOA 어댑터는 WAF 우회를 위해 브라우저 UA 를 쓰는데
//   (PD 소스라 그 판단이 성립했다), 상업 발행사에는 그렇게 하지 않는다. 우리 UA 가 차단되면
//   그건 "읽지 말라"는 답이고, 우회는 규율을 지키는 척하면서 어기는 것이다.
//   403 은 재시도 대상이 아니라 **그 발행사를 목록에서 빼는 근거**다.

import { parseRssFeed, type RssListItem } from '../ingest-article/_helpers'
import {
  COMPOSE_USER_AGENT,
  CrawlGate,
  parseRobots,
  readForFacts,
  type FactRead,
} from './access'
import { COMPOSE_THRESHOLDS } from './gates'
import { isCollectable, lineOf, type FactSourceSpec } from './sources'

// ── 주입 ─────────────────────────────────────────────────────────────

export interface FetchResult {
  ok: boolean
  status: number
  text: string
}

/** 네트워크·시계 주입 — 테스트에서 실제 요청 없이 전 경로를 돌린다. */
export interface FetchDeps {
  fetchText(url: string, headers: Record<string, string>): Promise<FetchResult>
  now(): number
  sleep(ms: number): Promise<void>
}

function headers(): Record<string, string> {
  return { 'User-Agent': COMPOSE_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml' }
}

// ── robots ───────────────────────────────────────────────────────────

export type RobotsOutcome =
  /** robots.txt 를 읽어 규칙을 등록했다 */
  | 'ok'
  /** robots.txt 가 없다(404) — 규칙 없음으로 등록 */
  | 'absent'
  /** 가져오지 못했다 — 게이트가 이 호스트를 막는다 */
  | 'failed'

/**
 * 호스트의 robots.txt 를 가져와 게이트에 등록.
 *
 * 404 는 "규칙 없음"(허용)이지만 5xx·네트워크 실패는 **차단**으로 등록한다 —
 * 서버가 답을 못 준 것을 허락으로 읽지 않는다.
 */
export async function primeRobots(
  host: string,
  gate: CrawlGate,
  deps: FetchDeps,
): Promise<RobotsOutcome> {
  let res: FetchResult
  try {
    res = await deps.fetchText(`https://${host}/robots.txt`, headers())
  } catch {
    gate.setRobots(host, null)
    return 'failed'
  }
  if (res.status === 404) {
    gate.setRobots(host, parseRobots(''))
    return 'absent'
  }
  if (!res.ok) {
    gate.setRobots(host, null)
    return 'failed'
  }
  gate.setRobots(host, parseRobots(res.text))
  return 'ok'
}

// ── 발견 ─────────────────────────────────────────────────────────────

export interface StoryCandidate {
  sourceKey: string
  publisher: string
  /** 취재 계통 — 같은 계통은 독립 출처로 세지 않는다 */
  wire: string | null
  title: string
  url: string
  published_at: string | null
  /** I15(48시간)를 채우기까지 남은 시간(ms). 0 이면 지금 읽어도 된다. */
  holdMs: number
}

export interface DiscoverResult {
  /** 지금 읽어도 되는 후보 (holdMs=0) */
  ready: StoryCandidate[]
  /** 아직 48시간이 안 지난 후보 — 버리지 않고 남긴다 */
  holding: StoryCandidate[]
  /** 제외된 항목과 사유 */
  skipped: Array<{ url: string; reason: string }>
}

export interface DiscoverOptions {
  /** 후보 상한 */
  maxItems?: number
  /** 지연 기준(시간). 기본은 I15 와 같은 48. */
  minDelayHours?: number
}

/**
 * 발행사 피드 → 사건 후보.
 *
 * 날짜가 없는 항목은 **제외한다** — I15(발행 지연)를 검증할 수 없는 것을 통과시키면
 * 게이트가 있으나 마나가 된다. 뉴스 피드에서 날짜 없는 항목은 대개 목차·기획 페이지다.
 */
export async function discoverStories(
  spec: FactSourceSpec,
  feedUrl: string,
  gate: CrawlGate,
  deps: FetchDeps,
  opts: DiscoverOptions = {},
): Promise<DiscoverResult> {
  const maxItems = opts.maxItems ?? 20
  const minDelayMs = (opts.minDelayHours ?? COMPOSE_THRESHOLDS.minDelayHours) * 3_600_000

  if (!isCollectable(spec)) {
    return {
      ready: [],
      holding: [],
      skipped: [
        {
          url: feedUrl,
          reason: `${spec.key}: 수집 조건 미충족 (배선=${spec.wiring} · 약관확인=${spec.access.termsReviewed}). 약관 확인 전에는 수집하지 않는다.`,
        },
      ],
    }
  }

  const decision = gate.check(feedUrl, deps.now())
  if (!decision.allowed) {
    return { ready: [], holding: [], skipped: [{ url: feedUrl, reason: decision.reason! }] }
  }
  if (decision.waitMs > 0) await deps.sleep(decision.waitMs)

  let res: FetchResult
  try {
    gate.markFetched(feedUrl, deps.now())
    res = await deps.fetchText(feedUrl, headers())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ready: [], holding: [], skipped: [{ url: feedUrl, reason: `피드 요청 실패: ${msg}` }] }
  }
  if (res.status === 403) {
    return {
      ready: [],
      holding: [],
      skipped: [
        {
          url: feedUrl,
          reason: `${spec.publisher} 가 우리 UA 를 거절했다(403). 브라우저 UA 로 우회하지 않는다 — 이 발행사를 목록에서 뺀다.`,
        },
      ],
    }
  }
  if (!res.ok) {
    return { ready: [], holding: [], skipped: [{ url: feedUrl, reason: `피드 응답 ${res.status}` }] }
  }

  const ready: StoryCandidate[] = []
  const holding: StoryCandidate[] = []
  const skipped: Array<{ url: string; reason: string }> = []
  const now = deps.now()

  for (const item of parseRssFeed(res.text).slice(0, maxItems)) {
    const cand = toCandidate(spec, item, now, minDelayMs)
    if ('reason' in cand) skipped.push({ url: item.url, reason: cand.reason })
    else if (cand.holdMs > 0) holding.push(cand)
    else ready.push(cand)
  }

  return { ready, holding, skipped }
}

function toCandidate(
  spec: FactSourceSpec,
  item: RssListItem,
  now: number,
  minDelayMs: number,
): StoryCandidate | { reason: string } {
  if (!item.published_at) {
    return { reason: '발행 시각 없음 — I15(48시간)를 검증할 수 없어 제외' }
  }
  const t = new Date(item.published_at).getTime()
  if (Number.isNaN(t)) return { reason: `발행 시각 해석 불가: ${item.published_at}` }

  const elapsed = now - t
  return {
    sourceKey: spec.key,
    publisher: spec.publisher,
    wire: spec.wire,
    title: item.title,
    url: item.url,
    published_at: item.published_at,
    holdMs: Math.max(0, minDelayMs - elapsed),
  }
}

/** 같은 사건 후보들을 독립 계통 수로 평가 — 취재를 시작할지 판단하는 자리. */
export function countIndependentLines(candidates: StoryCandidate[]): number {
  return new Set(candidates.map((c) => c.wire ?? c.publisher.toLowerCase())).size
}

// ── 읽기 ─────────────────────────────────────────────────────────────

/** article_compose_sources INSERT 에 그대로 들어가는 모양. 본문 컬럼은 없다. */
export interface ComposeSourceRow {
  publisher: string
  url: string
  published_at: string | null
  fingerprint: unknown
  access_basis: FactSourceSpec['access']['basis']
  robots_checked_at: string | null
  wire: string | null
}

export type ReadStoryResult<T> =
  | { ok: true; row: ComposeSourceRow; read: FactRead<T> }
  | { ok: false; reason: string }

/**
 * 후보 1건을 읽어 **지문 + 추출 결과**만 돌려준다.
 *
 * extract 콜백은 본문을 받지만 **사실 카드처럼 원문 표현이 아닌 산출물**만 돌려줘야 한다.
 * 본문은 이 함수 스코프를 벗어나지 못하고, 위반은 I13(표현 독립성)이 잡는다.
 */
export async function readStoryForFacts<T>(
  spec: FactSourceSpec,
  url: string,
  gate: CrawlGate,
  deps: FetchDeps,
  extract: (body: string) => T | Promise<T>,
): Promise<ReadStoryResult<T>> {
  if (!isCollectable(spec)) {
    return { ok: false, reason: `${spec.key}: 약관 확인 전에는 수집하지 않는다` }
  }

  const decision = gate.check(url, deps.now())
  if (!decision.allowed) return { ok: false, reason: decision.reason! }
  if (decision.waitMs > 0) await deps.sleep(decision.waitMs)

  let res: FetchResult
  try {
    gate.markFetched(url, deps.now())
    res = await deps.fetchText(url, headers())
  } catch (e) {
    return { ok: false, reason: `요청 실패: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (res.status === 403) {
    return {
      ok: false,
      reason: `${spec.publisher} 가 우리 UA 를 거절했다(403). 우회하지 않는다.`,
    }
  }
  if (!res.ok) return { ok: false, reason: `응답 ${res.status}` }

  const read = await readForFacts(async () => res.text, extract)

  return {
    ok: true,
    read,
    row: {
      publisher: spec.publisher,
      url,
      published_at: null, // 호출부가 후보의 published_at 을 넣는다
      fingerprint: read.fingerprint,
      access_basis: spec.access.basis,
      // page-fetch 는 DB CHECK(chk_compose_source_robots)가 이 값을 요구한다.
      robots_checked_at: spec.access.robotsCheck ? read.readAt.toISOString() : null,
      wire: lineOf(spec) === spec.publisher.toLowerCase() ? null : spec.wire,
    },
  }
}
