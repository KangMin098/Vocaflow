// packages/library-pipeline/src/compose/section-page.ts
//
// ACP §20 — **RSS 가 없는 섹션에서 기사 목록을 얻는다.**
//
// ── 왜 필요한가 (실측 2026-08-19) ─────────────────────────────────────
// 학습 적합률은 **어느 발행사냐보다 그 안의 어느 섹션이냐**로 갈린다:
//
//   섹션 피드 412항목 · 가중 적합률 25.0%   (BBC 과학 47.6% · 코리아타임스 라이프 42.9%)
//   전체 피드 424항목 · 가중 적합률 14.2%   (연합 English 5.9% · ABC Just In 4.0%)
//                                            → 섹션이 1.76배
//
// 그런데 등록 경로가 **RSS 로만 열려 있었다**. `verifyFeedUrl` 은 항목이 파싱되지 않으면
// "피드가 아닙니다" 로 거부하므로, RSS 를 안 주는 섹션(오피니언·칼럼이 특히 그렇다)은
// 아예 쓸 수 없었다. 발행사가 RSS 를 주지 않는다는 이유로 **가장 적합한 섹션이 빠졌다.**
//
// ── 설계: RSS 와 같은 모양을 돌려준다 ──────────────────────────────────
// `RssListItem[]` 을 그대로 반환한다. 그래야 묶기·보류·취재·게이트 전부가 안 바뀐다.
// 새 경로를 만들면서 하류를 갈라 놓으면, 같은 사건이 경로에 따라 다르게 처리된다.
//
// ⚠️ **발행 시각이 없는 항목은 버린다.** 섹션 목록은 날짜를 안 보여 주는 경우가 많은데,
//   I15(48시간 보류)를 검증할 수 없는 것을 통과시키면 게이트가 있으나 마나가 된다.
//   주소에 박힌 날짜(`dateFromUrl`)로 채울 수 있으면 채우고, 아니면 제외한다.
//
// ⚠️ 이건 **목록 페이지**만 읽는다. 본문은 취재 단계(`readStoryForFacts`)가 규율 아래 읽고
//   지문만 남긴다. 여기서 본문을 가져오지 않는다.

import { dateFromUrl, decodeEntities, stripTags, type RssListItem } from '../ingest-article/_helpers'

/**
 * 기사 링크로 보지 않을 경로.
 *
 * 섹션 페이지에는 기사보다 **네비게이션이 훨씬 많다** — 태그·필자·구독·검색·페이지 넘김.
 * 이것들을 안 걸러 내면 후보가 수백 건 늘고 그중 기사는 몇 건뿐이다.
 */
const NON_ARTICLE_PATH =
  /\/(tag|tags|topic|topics|author|authors|byline|category|categories|section|sections|page|search|subscribe|newsletter|login|signin|signup|account|about|contact|privacy|terms|rss|feed|sitemap|video|photo|gallery|podcast)(\/|$)/i

/** 제목으로 보기에 너무 짧은 링크 글자 수 — 네비게이션은 한두 단어다. */
const MIN_TITLE_WORDS = 4

/** 한 페이지에서 가져올 최대 기사 수. 목록 페이지는 무한 스크롤이 흔하다. */
export const MAX_SECTION_ITEMS = 60

/**
 * 링크 안에서 **제목만** 뽑는다.
 *
 * 목록 카드는 대개 `<a><h3>제목</h3><p>리드…</p></a>` 모양이라, 태그를 그냥 벗기면
 * 제목과 리드가 붙어 버린다. 실측 2026-08-19(코리아타임스 lifestyle):
 *   `Seoul's matchmaking program returns as 1st couple prepares to wedThe Seoul city…`
 * 묶기(clusterStories)가 제목으로 이뤄지므로, 리드가 붙으면 같은 사건이 안 묶인다.
 *
 * 제목 요소(h1~h6)가 있으면 그것만 쓰고, 없으면 전체 글자를 쓴다.
 */
function titleFromAnchor(inner: string): string {
  const heading = inner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)
  const raw = heading?.[1] ?? inner
  return stripTags(decodeEntities(raw)).replace(/\s+/g, ' ').trim()
}

/**
 * 섹션 목록 페이지 HTML → 기사 후보.
 *
 * 같은 호스트의 링크만 본다. 발행사 페이지에 실린 외부 링크(광고·제휴)를 그 발행사의
 * 기사로 세면 계통 판정이 통째로 틀어진다.
 */
export function parseSectionPage(
  html: string,
  pageUrl: string,
  nowMs: number = Date.now(),
): RssListItem[] {
  let base: URL
  try {
    base = new URL(pageUrl)
  } catch {
    return []
  }

  const out: RssListItem[] = []
  const seen = new Set<string>()
  const anchor = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null

  while ((m = anchor.exec(html)) !== null && out.length < MAX_SECTION_ITEMS) {
    const href = m[2] ?? m[3] ?? m[4]
    if (!href || href.startsWith('#') || /^(mailto|javascript|tel):/i.test(href)) continue

    let abs: URL
    try {
      abs = new URL(decodeEntities(href), base)
    } catch {
      continue
    }
    if (abs.host.toLowerCase() !== base.host.toLowerCase()) continue
    if (NON_ARTICLE_PATH.test(abs.pathname)) continue
    // 섹션 페이지 자신과 상위 목록은 기사가 아니다.
    if (abs.pathname.replace(/\/$/, '') === base.pathname.replace(/\/$/, '')) continue

    // 링크 글자에서 제목을 얻는다. 이미지 링크는 글자가 없어 여기서 빠진다.
    const title = titleFromAnchor(m[5] ?? '')
    if (title.split(/\s+/).filter(Boolean).length < MIN_TITLE_WORDS) continue

    const url = abs.toString()
    if (seen.has(url)) continue

    // 발행 시각을 못 채우면 버린다 — I15 를 검증할 수 없는 것을 통과시키지 않는다.
    const published_at = dateFromUrl(url, nowMs)
    if (!published_at) continue

    seen.add(url)
    out.push({
      guid: url,
      title,
      url,
      published_at,
      date_source: 'url',
      description: '',
    })
  }
  return out
}

/**
 * 이 응답이 섹션 목록 페이지로 쓸 만한가 — 등록 화면이 "왜 안 되는지" 를 말할 수 있게.
 *
 * 항목 0 의 사유를 나누는 것이 목적이다. "HTML 이 아니다" 와 "기사에 날짜가 없다" 는
 * 운영자가 할 일이 다르다(전자는 주소가 틀린 것, 후자는 그 섹션을 못 쓰는 것).
 */
export function inspectSectionPage(
  html: string,
  pageUrl: string,
  nowMs: number = Date.now(),
): { ok: boolean; itemCount: number; reason: string | null } {
  if (!/<a\b/i.test(html)) {
    return { ok: false, itemCount: 0, reason: '링크가 하나도 없다 — 목록 페이지가 아니다' }
  }
  const items = parseSectionPage(html, pageUrl, nowMs)
  if (items.length === 0) {
    return {
      ok: false,
      itemCount: 0,
      reason:
        '기사 링크를 찾지 못했다 — 주소에 날짜가 없는 발행사이거나(발행 시각을 확인할 수 없어 제외) 목록이 스크립트로 그려지는 페이지다',
    }
  }
  return { ok: true, itemCount: items.length, reason: null }
}
