// apps/web/src/lib/topic-corpus/ted-discover.ts
//
// TED 주제 → 강연 URL 목록 (큐 적재용). **본문은 건드리지 않는다** — 여기서 다루는 것은
// slug·URL·제목 같은 메타데이터뿐이다.
//
// ── 이 모듈이 조심스러운 이유 (2026-08-16 실측) ──
// 주제 페이지(`/topics/<slug>`)의 `__NEXT_DATA__` 에는 `talks` 16편 + `talksTotalCount` 가 있다.
// 처음엔 `?page=N` 으로 페이징될 것이라 짐작했는데, **실측하니 `?page=2` 가 1페이지와 같은
// 16편을 그대로 돌려줬다** (slug 16개 전부 중복). 목록은 클라이언트가 따로 불러온다.
//
// 이걸 확인하지 않고 짰다면 드레인은 같은 16편을 무한히 다시 넣으면서 "성공" 을 보고했을 것이다
// — 큐는 계속 차고, 통계는 안 자라고, 화면 어디에도 이상이 안 보인다. 가장 나쁜 종류의 결함이다.
//
// 그래서 이 모듈은 **찾은 편수와 TED 가 밝힌 총 편수를 함께 돌려준다**. 둘이 다르면
// 그 차이는 화면에 그대로 뜬다 (`DiscoverResult.coverageGap`). 조용한 축소는 만들지 않는다.
//
// 전량 수집이 필요하면 `enqueue` API 에 URL 목록을 직접 넘기는 경로를 쓴다 — 외부 사이트의
// 비공개 내부 API 에 의존하지 않는 유일하게 안정적인 방법이다.

/** 발견된 강연 1편 — 메타데이터만 */
export interface DiscoveredTalk {
  externalId: string
  url: string
  title: string | null
}

export interface DiscoverResult {
  topicKey: string
  talks: DiscoveredTalk[]
  /** TED 가 밝힌 이 주제의 총 강연 수 */
  totalCount: number | null
  /**
   * 총 편수 − 이번에 찾은 편수. 0 이 아니면 **이 주제는 아직 다 수집되지 않았다**.
   * 화면은 이 값을 반드시 노출한다 — 안 보이면 "다 했다" 로 오독된다.
   */
  coverageGap: number | null
}

import { nodeFetcher, type HtmlFetcher } from './http-fetch'

export class TedDiscoverError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TedDiscoverError'
  }
}

/** slug → 표준 강연 URL */
export function talkUrlFromSlug(slug: string): string {
  return `https://www.ted.com/talks/${slug}`
}

/**
 * 주제 페이지 HTML → 강연 목록. 네트워크를 타지 않으므로 고정 입력으로 테스트할 수 있다.
 */
export function parseTedTopicHtml(html: string, topicKey: string): DiscoverResult {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) {
    throw new TedDiscoverError(`__NEXT_DATA__ 없음 — 주제 페이지 구조 변경 의심: ${topicKey}`)
  }

  let data: unknown
  try {
    data = JSON.parse(m[1]!)
  } catch {
    throw new TedDiscoverError(`__NEXT_DATA__ JSON 파싱 실패: ${topicKey}`)
  }

  // 남의 페이지 내부 구조라 언제든 바뀐다 — 필요한 가지만 좁게 선언하고 나머지는 unknown 으로 둔다.
  // (`any` 로 받으면 아래 접근이 전부 무검사가 되고, 프로덕션 빌드의 lint 게이트도 막힌다.)
  const pageProps =
    (data as { props?: { pageProps?: { talks?: unknown; talksTotalCount?: unknown } } })?.props
      ?.pageProps ?? {}
  const rawTalks: unknown[] = Array.isArray(pageProps.talks) ? pageProps.talks : []

  const seen = new Set<string>()
  const talks: DiscoveredTalk[] = []
  for (const raw of rawTalks) {
    const t = raw as Record<string, unknown>
    const slug = typeof t?.slug === 'string' ? t.slug : null
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    talks.push({
      externalId: slug,
      url: typeof t?.canonicalUrl === 'string' ? t.canonicalUrl : talkUrlFromSlug(slug),
      title: typeof t?.title === 'string' ? t.title : null,
    })
  }

  const totalCount =
    typeof pageProps?.talksTotalCount === 'number' ? pageProps.talksTotalCount : null

  return {
    topicKey,
    talks,
    totalCount,
    coverageGap: totalCount === null ? null : Math.max(totalCount - talks.length, 0),
  }
}

/** 주제 페이지에서 노출되는 만큼의 강연 목록을 가져온다. */
export async function discoverTedTopic(
  topicKey: string,
  signal?: AbortSignal,
  /** 전송 계층 — TED 는 undici 지문을 403 으로 막으므로 CLI 는 `curlFetcher` 를 넘긴다. */
  fetcher: HtmlFetcher = nodeFetcher,
): Promise<DiscoverResult> {
  const url = `https://www.ted.com/topics/${encodeURIComponent(topicKey)}`
  let html: string
  try {
    html = await fetcher(url, signal)
  } catch (err) {
    throw new TedDiscoverError(err instanceof Error ? err.message : `가져오기 실패 — ${url}`)
  }
  return parseTedTopicHtml(html, topicKey)
}
