// apps/web/src/lib/topic-corpus/ted-transcript.ts
//
// TED 강연 자막 → **메모리 상의 텍스트**. 어디에도 저장하지 않는다.
//
// ── 이 모듈이 존재하는 이유 ──
// TCP(주제 코퍼스 파이프라인)는 "어떤 단어가 어떤 주제에서 두드러지는가" 를 관측한다.
// 그러려면 원문을 한 번 읽어야 하지만, TED 자막은 CC BY-NC-ND 4.0(비영리·2차적저작물 금지)이라
// **보관하면 안 된다**. 그래서 이 모듈의 반환값은 호출자의 스택에서만 살고,
// `harvestTedTalk` 이 카운트로 바꾼 즉시 버려진다. DB 로 넘어가는 것은 숫자뿐이다.
//
// ── 파싱 근거 (2026-08-16 실측) ──
// 자막 페이지는 Next.js 앱이고 `<script id="__NEXT_DATA__">` 에 전체 상태가 들어 있다.
//   · 본문   `props.pageProps.transcriptData.translation.paragraphs[].cues[].text`
//   · 메타   `props.pageProps.videoData` → title · presenterDisplayName · publishedAt · slug · topics.nodes
// 실측 검증: 36 문단 / 308 cue / 약 13,250자.
//
// **DOM 스크래핑을 하지 않는 이유**: 자막은 클래스명이 자주 바뀌는 렌더 결과물이라
// 셀렉터가 깨지면 조용히 0건을 수확한다(큐는 done 이 되고 통계는 안 쌓인다 — 최악의 실패).
// `__NEXT_DATA__` 는 계약에 가깝고, 없으면 **명시적으로 에러**를 내 큐가 failed 로 남는다.

import { HttpFetchError, nodeFetcher, type HtmlFetcher } from './http-fetch'

/** 자막 1편의 파싱 결과. `text` 는 저장 금지 — 카운트로 바꾼 뒤 버린다. */
export interface TedTranscript {
  externalId: string
  url: string
  title: string | null
  speaker: string | null
  publishedAt: string | null
  /** TED 자체 주제 태그 — 수확한 주제가 실제로 그 주제였는지 교차 확인용 */
  tedTopics: string[]
  /** 자막 본문 (메모리 전용) */
  text: string
}

export class TedTranscriptError extends Error {
  constructor(
    message: string,
    readonly reason: 'http' | 'blocked' | 'no-next-data' | 'no-transcript' | 'too-short',
  ) {
    super(message)
    this.name = 'TedTranscriptError'
  }
}

/** 자막이 이보다 짧으면 수확 가치가 없다 (예고편·음악 전용 항목 등) */
const MIN_CHARS = 400

/** 강연 URL → 자막 URL. 이미 /transcript 로 끝나면 그대로 둔다. */
export function toTranscriptUrl(url: string): string {
  const clean = url.split('?')[0]!.replace(/\/+$/, '')
  return clean.endsWith('/transcript') ? clean : `${clean}/transcript`
}

/** 강연 URL → slug (external_id). `/talks/<slug>` 의 slug 부분. */
export function tedSlugFromUrl(url: string): string | null {
  const m = /\/talks\/([^/?#]+)/.exec(url)
  return m ? m[1]! : null
}

interface NextDataCue {
  text?: string
}
interface NextDataParagraph {
  cues?: NextDataCue[]
}

/**
 * HTML → 자막. 네트워크를 타지 않으므로 테스트에서 고정 입력으로 검증할 수 있다.
 *
 * cue 를 이을 때 **공백 한 칸**을 넣는다. 붙여 버리면 문장 끝 단어와 다음 문장 첫 단어가
 * 하나로 합쳐져 사전에 없는 유령 단어가 생긴다(그리고 그게 사전 갭으로 오적재된다).
 */
export function parseTedTranscriptHtml(html: string, url: string): TedTranscript {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) {
    throw new TedTranscriptError(`__NEXT_DATA__ 없음 — 페이지 구조 변경 의심: ${url}`, 'no-next-data')
  }

  let data: unknown
  try {
    data = JSON.parse(m[1]!)
  } catch {
    throw new TedTranscriptError(`__NEXT_DATA__ JSON 파싱 실패: ${url}`, 'no-next-data')
  }

  const pageProps = (data as Record<string, any>)?.props?.pageProps ?? {}
  const paragraphs: NextDataParagraph[] =
    pageProps?.transcriptData?.translation?.paragraphs ?? []

  const text = paragraphs
    .flatMap((p) => p.cues ?? [])
    .map((c) => (c.text ?? '').trim())
    .filter((t) => t.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length === 0) {
    throw new TedTranscriptError(`자막 없음 (번역만 있거나 비공개): ${url}`, 'no-transcript')
  }
  if (text.length < MIN_CHARS) {
    throw new TedTranscriptError(
      `자막이 너무 짧음 (${text.length}자 < ${MIN_CHARS}): ${url}`,
      'too-short',
    )
  }

  const video = pageProps?.videoData ?? {}
  const topicNodes: unknown[] = video?.topics?.nodes ?? []

  return {
    externalId: video?.slug || tedSlugFromUrl(url) || url,
    url,
    title: typeof video?.title === 'string' ? video.title : null,
    speaker:
      typeof video?.presenterDisplayName === 'string' ? video.presenterDisplayName : null,
    publishedAt: typeof video?.publishedAt === 'string' ? video.publishedAt : null,
    tedTopics: topicNodes
      .map((n) => (n as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === 'string'),
    text,
  }
}

/**
 * 자막 페이지를 받아 파싱한다.
 *
 * 호출자는 반환된 `text` 를 **카운트로 바꾼 뒤 즉시 버려야 한다** — 이 계약을 지키는 곳은
 * `harvest.ts` 한 군데뿐이고, 다른 곳에서 이 함수를 직접 부르지 않는 것이 규칙이다.
 */
export async function fetchTedTranscript(
  talkUrl: string,
  signal?: AbortSignal,
  /**
   * 전송 계층. 기본은 Node 내장 fetch 인데, TED 는 undici 지문을 403 으로 막으므로
   * CLI·서버 경로에서는 `curlFetcher` 를 넘긴다 (`http-fetch.ts` 주석 참조).
   */
  fetcher: HtmlFetcher = nodeFetcher,
): Promise<TedTranscript> {
  const url = toTranscriptUrl(talkUrl)

  let html: string
  try {
    html = await fetcher(url, signal)
  } catch (err) {
    const status = err instanceof HttpFetchError ? err.status : null
    // 403 은 "일시적 장애" 가 아니라 **전송 계층이 잘못 선택된 것**이다. 실측(2026-08-16):
    //   · Node 내장 fetch(undici) → 403  (헤더를 브라우저처럼 다 맞춰도 동일)
    //   · curl                    → 200  (같은 URL · 같은 UA)
    // 헤더가 아니라 TLS 지문에서 갈리므로 UA 교체·재시도로는 절대 풀리지 않는다.
    // 해결은 `curlFetcher` 를 주입하는 것이다 — 다음 사람이 헤더 조합을 다시 실험하지 않도록 명시한다.
    if (status === 403) {
      throw new TedTranscriptError(
        `HTTP 403 — 전송 계층 문제다(TLS 지문). 헤더/UA 로는 풀리지 않으니 ` +
          `\`curlFetcher\` 를 주입할 것 (lib/topic-corpus/http-fetch.ts): ${url}`,
        'blocked',
      )
    }
    throw new TedTranscriptError(
      err instanceof Error ? err.message : `가져오기 실패 — ${url}`,
      'http',
    )
  }

  return parseTedTranscriptHtml(html, url)
}
