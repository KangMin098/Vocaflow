// packages/library-pipeline/src/compose/collect.ts
//
// ACP §20 재저작 — 수집 오케스트레이션.
//
// 피드 여러 개 → robots 확인 → 발견 → 사건 묶기 → **취재 제안**.
// 이 단계는 아직 아무것도 읽지 않는다(본문 fetch 없음). 제목·시각만 보고 "무엇을 취재할지"
// 를 고르고, 실제 읽기(readStoryForFacts)는 사람이 고른 묶음에 대해서만 일어난다.
//
// 왜 나눴나: 본문 읽기는 요청 비용이자 상대 서버 부하다. 발견 단계에서 후보를 100건 만들고
// 그중 3건만 취재한다면, 97건은 **읽지 않아야 한다**. 피드만으로 고를 수 있는 것을
// 본문까지 받아 보고 고르면 규율은 지켰어도 예의는 아니다.

import { CrawlGate } from './access'
import { clusterStories, type StoryCluster } from './cluster'
import {
  discoverStories,
  primeRobots,
  type DiscoverOptions,
  type FetchDeps,
  type RobotsOutcome,
  type StoryCandidate,
} from './news-feed'
import { FACT_SOURCES, isCollectable, type FactSourceSpec } from './sources'

/** 운영자가 등록하는 피드 1건. 주소는 코드가 아니라 설정에서 온다. */
export interface FeedConfig {
  /** FACT_SOURCES 키 */
  sourceKey: string
  /** 발행사가 공개한 피드 주소 */
  url: string
  /** 관리 화면 표시용 */
  label: string
  enabled: boolean
}

export interface CollectReport {
  /** 취재할 만한 묶음 (독립 계통 2개 이상) */
  pursue: StoryCluster[]
  /** 단독 보도 — 지금은 못 쓰지만 다음 수집에서 다른 계통이 붙을 수 있다 */
  singleLine: StoryCluster[]
  /** 아직 48시간이 안 지난 후보 */
  holding: StoryCandidate[]
  /** 호스트별 robots 확인 결과 */
  robots: Record<string, RobotsOutcome>
  /** 건너뛴 피드·항목과 사유 (조용한 실패 금지) */
  skipped: Array<{ url: string; reason: string }>
  /** 실제로 보낸 요청 수 — 부하를 스스로 계측한다 */
  requests: number
  /**
   * 피드 URL → 이 피드가 실제로 내놓은 항목 수 (**보류분 포함**).
   *
   * 왜 따로 세는가: 화면의 "찾음" 을 묶음에 들어간 항목만으로 세면, 갓 올라온 기사는
   * 48시간 보류에 걸려 빠지므로 **잘 도는 피드가 0 으로 보인다**. 실측에서 DW 는 137항목을
   * 내놓고도 0 으로 표시됐다 — 운영자에게는 죽은 피드와 구별되지 않는다.
   */
  perFeed: Record<string, number>
}

export interface CollectOptions extends DiscoverOptions {
  /** FACT_SOURCES 대신 쓸 레지스트리 (테스트 주입) */
  registry?: Record<string, FactSourceSpec>
  /** 이미 robots 가 등록된 게이트를 재사용 */
  gate?: CrawlGate
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * 피드 목록 → 취재 제안.
 *
 * 실패는 전부 `skipped` 에 사유와 함께 남는다. 조용히 0건을 돌려주면 운영자는
 * "오늘은 사건이 없었다" 와 "전부 차단됐다" 를 구별할 수 없다.
 */
export async function collectStories(
  feeds: FeedConfig[],
  deps: FetchDeps,
  opts: CollectOptions = {},
): Promise<CollectReport> {
  const registry = opts.registry ?? FACT_SOURCES
  const gate = opts.gate ?? new CrawlGate()

  const robots: Record<string, RobotsOutcome> = {}
  const skipped: Array<{ url: string; reason: string }> = []
  const candidates: StoryCandidate[] = []
  const holding: StoryCandidate[] = []
  const perFeed: Record<string, number> = {}
  let requests = 0

  for (const feed of feeds) {
    if (!feed.enabled) {
      skipped.push({ url: feed.url, reason: `${feed.label}: 비활성` })
      continue
    }
    const spec = registry[feed.sourceKey]
    if (!spec) {
      skipped.push({ url: feed.url, reason: `알 수 없는 소스 키: ${feed.sourceKey}` })
      continue
    }
    if (!isCollectable(spec)) {
      skipped.push({
        url: feed.url,
        reason: `${spec.key}: 수집 조건 미충족 (배선=${spec.wiring} · 약관확인=${spec.access.termsReviewed})`,
      })
      continue
    }
    const host = hostOf(feed.url)
    if (!host) {
      skipped.push({ url: feed.url, reason: 'URL 형식 오류' })
      continue
    }

    if (!(host in robots)) {
      robots[host] = await primeRobots(host, gate, deps)
      requests++
    }
    if (robots[host] === 'failed') {
      skipped.push({ url: feed.url, reason: `${host}: robots.txt 를 가져오지 못했다 — 수집 보류` })
      continue
    }

    const res = await discoverStories(spec, feed.url, gate, deps, opts)
    requests++
    candidates.push(...res.ready)
    holding.push(...res.holding)
    skipped.push(...res.skipped)
    perFeed[feed.url] = res.ready.length + res.holding.length
  }

  const clusters = clusterStories(candidates)
  return {
    pursue: clusters.filter((c) => c.worthPursuing),
    singleLine: clusters.filter((c) => !c.worthPursuing),
    holding,
    robots,
    perFeed,
    skipped,
    requests,
  }
}

/**
 * 취재 제안 → 취재 묶음(article_compose_batches) INSERT 모양.
 * event_occurred_at 은 가장 이른 보도 시각을 쓴다 — 사건 시각의 보수적 대용치이며,
 * 실제 사건은 그보다 앞이므로 I15(48시간)를 짧게 잡는 쪽으로 틀리지 않는다.
 */
export function toBatchRow(cluster: StoryCluster): {
  topic: string
  event_occurred_at: string | null
  status: 'collecting'
} {
  return {
    topic: cluster.headline,
    event_occurred_at: cluster.earliestAt || null,
    status: 'collecting',
  }
}
