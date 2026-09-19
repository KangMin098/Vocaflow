// packages/library-pipeline/src/ingest-article/usgs.ts
// ACP §18 — USGS (U.S. Geological Survey) ingester.
//
// USGS = 미국 지질조사국. PD(US Government) 지구과학·자연재해·지질 산문(B2 과학 저널리즘).
//   신규 도메인 — NASA(우주)·NIH(건강)과 구별되는 earth-science(지진·화산·허리케인·광물·산사태).
// 라이선스: Public Domain (US Government) → license_class=public_domain → 발행 허용 · 인용 자유.
// register: expository — 자연현상·과학 설명문 (CSAT 과학 지문 유형과 유사).
// 서버렌더 Drupal HTML. 의존성 0 정규식.
//
// 리스트: /news/featured-stories · /news/science-snippets (c-usgs-teaser 카드 → 제목+teaser).
// 본문:  node-main-body 컨테이너(intro + text-with-media 필드).
//        d-media-copyright(이미지 크레딧 반복) 제거 + related-*-tab/contacts/attributions/authors
//        트레일러 절단 + 맨 끝 "Learn More" 리소스 링크 블록 plain-text 컷
//        + usa-sr-only 라벨(`Media` 98편/322줄) · 스토리텔링 갤러리(캡션 띠 + `Close`) 제거
//        + usgs.gov 원문에 남은 마크다운 이스케이프 `\$` 되돌리기(87편/207회).
// source_id: "usgs:<slug>"

import type { RawArticle } from '../types-article'

import { decodeEntities, extractFirst, fetchWithTimeout, htmlToPlainText, safeDate, stripTags } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const SITE = 'https://www.usgs.gov'

export const USGS_FEEDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'featured', label: 'Featured Stories (USGS)', path: '/news/featured-stories' },
  { id: 'snippets', label: 'Science Snippets (USGS)', path: '/news/science-snippets' },
]

export interface UsgsListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}
/**
 * USWDS 시각 숨김 유틸리티(`usa-sr-only`) 안의 라벨을 **통째로** 뗀다.
 *
 * ── 무엇이 실측됐나 (2026-09-06 · usgs 전수 738편) ──────────────────────
 * `_helpers.ts` 의 `htmlToPlainText` 는 태그만 벗기고 안의 글자는 남긴다. USGS 는
 * 이미지 링크·버튼에 스크린리더 전용 라벨을 넣는데,
 *   <a class="media-link" aria-label="Media Link"><span class="usa-sr-only">Media</span> …
 * 이 `Media` 가 그대로 남아 **문단 사이에 홀로 뜬 한 줄**이 된다.
 *   · 단독 `Media` 줄 **98편 / 322줄**(2회 이상 등장 63편) · 단독 `Close` 줄 11편.
 *   · 재확인(2026-09-06, 신규 24편 직접 수확): `node-main-body` 안 sr-only 라벨 **54개**
 *     — `Media` 44 + 링크 라벨 10(`USGS Hurricanes Portal` 등).
 * 이런 줄이 본문에 남으면 순서·삽입 문항의 한 칸이 되고, 학습자는 글의 흐름이 아니라
 * **버튼 이름**을 읽고 순서를 맞춰야 한다. 아무 에러도 안 난다.
 *
 * ── 왜 오탐 위험이 거의 0 인가 ─────────────────────────────────────────
 * `usa-sr-only` 는 **정의상 화면에 안 보이는** USWDS 유틸리티 클래스다. 시각 독자가
 * 본 적 없는 글자라 지워서 잃을 본문이 없다. 반대로 문장 속 낱말(`social media` — 44편)은
 * 이 span **밖**에 있어 손대지 않는다. 텍스트가 아니라 **구조**로 잡기 때문이다.
 * (같은 교훈이 `_helpers.ts` figcaption 주석에 있다 — 구조로 잡히는 것을 추론으로 잡지 말 것.)
 *
 * ⚠️ 반드시 `htmlToPlainText` **전**에 돌려야 한다. 태그가 벗겨진 뒤에는 `Media` 가
 *   본문 낱말인지 버튼 라벨인지 구별할 근거가 사라진다.
 * ⚠️ 클래스 판정은 `class` 속성을 토큰으로 쪼개 본다 — `usa-sr-only-x` 같은 다른 클래스를
 *   부분일치로 삼키지 않기 위해서다.
 * ⚠️ 중첩 span 은 **일부러 매칭하지 않는다**(`(?!<span)` 가드). 안쪽 `</span>` 에서 잘려
 *   바깥 내용이 반쯤 남는 것보다 통과시키는 편이 안전하고, `g` 플래그 재시도에서
 *   안쪽 span 은 어차피 따로 잡힌다.
 *
 * `<label class="usa-sr-only">Label</label>` 도 같이 본다 — 검색 폼 라벨이라 표본 24편에선
 * 전부 `node-main-body` 밖이었지만, 들어오면 똑같이 홀로 뜬 `Label` 줄이 된다. 같은
 * USWDS 유틸리티라 판정 근거가 동일하다.
 */
function stripSrOnlyLabels(html: string): string {
  return html.replace(
    /<(span|label)\b([^>]*)>((?:(?!<\1\b)[\s\S])*?)<\/\1\s*>/gi,
    (whole: string, _tag: string, attrs: string) => {
      const cls = attrs.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
      // 낱말 자리가 붙어 버리지 않게 공백 한 칸으로 바꾼다(`htmlToPlainText` 가 다시 접는다).
      return cls.split(/\s+/).includes('usa-sr-only') ? ' ' : whole
    },
  )
}

/**
 * class 정규식 매칭 <div> 를 **여는 태그부터 짝 맞는 닫는 태그까지 통째로** 제거한다(중첩 div 안전).
 *
 * ⚠️ 이 파일의 오래된 제거 정규식들은 `<div …>[\s\S]*?<\/div>` 꼴이라 **첫 `</div>` 에서 끊긴다.**
 *   자식 div 가 있는 컨테이너에는 못 쓴다 — 아래 갤러리 위젯이 정확히 그 경우다.
 *   기존 줄은 실측으로 잘 돌고 있어 건드리지 않고, 새로 제거하는 것만 이 함수를 쓴다.
 */
function removeDivsByClass(html: string, classRe: RegExp): string {
  let out = html
  for (;;) {
    const openRe = /<div\b([^>]*)>/gi
    let m: RegExpExecArray | null
    let cutFrom = -1
    let cutTo = -1
    while ((m = openRe.exec(out)) !== null) {
      const cls = m[1]!.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
      if (!classRe.test(cls)) continue
      cutFrom = m.index
      const walk = /<div\b[^>]*>|<\/div\s*>/gi
      walk.lastIndex = openRe.lastIndex
      let depth = 1
      let w: RegExpExecArray | null
      while ((w = walk.exec(out)) !== null) {
        if (w[0].startsWith('</')) {
          depth--
          if (depth === 0) break
        } else depth++
      }
      // 닫는 태그를 못 찾으면(깨진 HTML) 여는 태그부터 끝까지 — 갤러리 위젯은 본문 뒤에 온다.
      cutTo = depth === 0 && w ? w.index + w[0].length : out.length
      break
    }
    if (cutFrom < 0) return out
    out = `${out.slice(0, cutFrom)}\n${out.slice(cutTo)}`
  }
}

/**
 * ③ 스토리텔링 미디어 그리드(`usgs-storytelling-media-grid`) — 캡션 띠 + `Close` 버튼의 **출처**.
 *
 * ── 실측 (2026-09-06, `securing-nations-need-native-seed` 실물) ──────────
 * 처음엔 plain-text 에서 「`Close` 줄 바로 위, 90자 이하이며 `.!?` 로 안 끝나는 연속 줄」을
 * 떼는 **추론 규칙**으로 잡으려 했다. 그러다 원문을 열어 보니 구조가 그대로 있었다:
 *
 *   <div class="…usgs-storytelling-media-grid--item" data-media="…" data-title="…">
 *     … <div class="media--storytelling-grid__overlay--title-text">Bike-produced seedballs …</div>
 *   <div class="usgs-storytelling-media-grid--overlay" aria-hidden="true"> …
 *     <button class="usgs-storytelling-media-grid--close" title="Close">…Close</button>
 *
 * 즉 캡션 띠 = 썸네일 오버레이 **제목**, `Close` = `aria-hidden="true"` 인 **빈 모달 틀**이다.
 * 둘 다 class 로 정확히 집히므로 **추론 규칙은 폐기했다.** 짧은 소제목(`Meeting a Crucial Need`)이
 * 캡션과 형태가 같아 길이·문장부호로는 절대 못 가르는데, 구조로는 오탐이 원리적으로 0 이다.
 * (`_helpers.ts` figcaption 주석의 교훈과 같다 — 구조로 잡히는 것을 추론으로 잡지 말 것.)
 *
 * `--overlay` 는 자식 div 를 여러 겹 품고 있어 **깊이 추적 제거**(`removeDivsByClass`)가 필요하다.
 * 오탐 위험: 이 두 class 는 갤러리 위젯 전용이고 산문 문단에는 쓰이지 않는다.
 */
function stripStorytellingGallery(html: string): string {
  let out = removeDivsByClass(html, /\busgs-storytelling-media-grid--overlay\b/)
  out = removeDivsByClass(out, /\bmedia--storytelling-grid__overlay--title-text\b/)
  return out
}

/** class 정규식 매칭 첫 <div> inner HTML 을 깊이 추적 슬라이스(중첩 div 안전). */
function sliceDivByClass(html: string, classRe: RegExp): string | null {
  const openRe = /<div\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = openRe.exec(html)) !== null) {
    const cls = m[1]!.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
    if (!classRe.test(cls)) continue
    const start = openRe.lastIndex
    const walk = /<div\b[^>]*>|<\/div\s*>/gi
    walk.lastIndex = start
    let depth = 1
    let w: RegExpExecArray | null
    while ((w = walk.exec(html)) !== null) {
      if (w[0].startsWith('</')) {
        depth--
        if (depth === 0) return html.slice(start, w.index)
      } else depth++
    }
    return html.slice(start)
  }
  return null
}

/**
 * USGS 기사 본문 HTML → 산문.
 *   node-main-body 슬라이스 → 크레딧/트레일러 제거 → 갤러리 위젯 제거 → sr-only 라벨 제거
 *   → plain → 줄 단위 잔여 정리.
 *
 * **단계 순서가 곧 정확도다.** 태그가 있어야만 할 수 있는 일(갤러리 위젯·sr-only 라벨 판정)을
 * `htmlToPlainText` **앞**에, 태그를 벗겨야 보이는 일(줄 단위 크레딧 컷·마크다운 이스케이프·
 * 맨 끝 링크 블록 컷)을 **뒤**에 둔다. 순서를 뒤집으면 `Media` 가 본문 낱말인지 버튼 라벨인지
 * 구별할 근거가 사라진다.
 */
export function extractProse(html: string): string {
  let body = sliceDivByClass(html, /\bnode-main-body\b/) ?? html
  // 이미지 크레딧 반복 블록 제거 (본문 중간에도 등장 — 각 이미지 뒤 "Sources/Usage: Public Domain...").
  body = body.replace(/<div[^>]*class="[^"]*d-media-copyright[^"]*"[\s\S]*?<\/div>/gi, '\n')
  // 관련 링크·연락처·기여자 트레일러 절단 (본문 이후 — 첫 트레일러부터 끝까지).
  body = body.replace(/<div[^>]*class="[^"]*paragraph--type--(?:related-[a-z-]+|contacts)[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<div[^>]*class="[^"]*field--name--field-(?:attributions|authors)[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '\n')
  // ③ 갤러리 위젯(캡션 띠 + `Close` 모달 틀) — 자식 div 를 품고 있어 깊이 추적으로 통째 제거.
  body = stripStorytellingGallery(body)
  // ① 스크린리더 전용 라벨(`Media` 98편/322줄) — **태그 제거 전**이어야 한다.
  //    `node-main-body` 슬라이스 **뒤**에 두는 것도 의도적이다: 사이트 네비의 라벨
  //    (`Menu`·`Close`·`Breadcrumb`)은 본문 밖이라 애초에 볼 일이 없다.
  body = stripSrOnlyLabels(body)

  let text = htmlToPlainText(body)
  // 이미지 크레딧 방탄 catch-all — 기사마다 컨테이너 class 가 달라(d-media-copyright 외) HTML
  //   스트립을 빠져나가는 경우가 있어, 크레딧 고정 텍스트("Sources/Usage:")로 라인 단위 제거.
  text = text.replace(/^[ \t]*Sources\/Usage:.*$/gim, '')
  // ② 마크다운 이스케이프 `\$` → `$`. **usgs.gov 원문에 있다 — 우리 변환기가 만든 게 아니다.**
  //    실측: `\$12M` · `\$6.1 billion` · `\$510 million` 형태로 **87편 / 207회**. 원문 HTML 을
  //    지금 다시 받아도 `…resulted in over \$12M&nbsp;in damage…` 그대로다(저장소에 마크다운
  //    변환기 의존성이 없다). 다른 원천 표본 1,600여 편에선 **0건** — usgs 전용 결함이다.
  //    ⚠️ **넓히지 않는다.** 이 원천에서 백슬래시 뒤에 온 문자는 `$` 뿐이었다(개행 1건 제외).
  //      `\\[구두점]` 같은 일반 규칙으로 만들 근거가 없고, 넓히면 LaTeX·경로를 망가뜨린다.
  text = text.replace(/\\\$/g, () => '$')
  // 태그 불문 plain-text 컷 — 맨 끝 리소스/링크 블록(자체 라인 heading, <a>·<strong> 등 다양).
  text = text.replace(
    /\n[ \t]*(?:Learn More|More Information|Related Content|See Also|Additional Resources|Further Reading|Get Our News)[ \t]*\n[\s\S]*$/i,
    '',
  )
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 목록 URL 1페이지분. Drupal 뷰라 `?page=N`(0-index)으로 넘어간다 — 실측 2026-08-30:
 * base·page=1·page=2 의 HTML 해시가 모두 달랐다.
 *
 * **왜 페이지가 필요한가**: 첫 페이지만 읽으면 최신 ~16편이 상한이고, 그걸 다 담는 순간
 * "새 것 0" 이 떠서 **소진처럼 보인다.** 위키미디어에서 겪은 것과 같은 조용한 상한이다.
 * 여기 USGS·NOAA 는 주제 적합도가 33~75% 로 재고 중 가장 높아서, 이 상한이 그대로
 * 수능 적합 지문 공급의 천장이 된다.
 */
export function buildUsgsListUrl(feedId: string, page: number = 0): string {
  const feed = USGS_FEEDS.find((f) => f.id === feedId) ?? USGS_FEEDS[0]!
  return page > 0 ? `${SITE}${feed.path}?page=${page}` : `${SITE}${feed.path}`
}

/** USGS 카드 리스트(c-usgs-teaser) → 항목. featured/snippets 공용(동일 Drupal teaser 뷰). */
export async function listUsgsFeed(
  feedId: string = 'featured',
  limit: number = 24,
): Promise<UsgsListItem[]> {
  return listUsgsFeedPage(feedId, limit, 0).then((r) => r.items)
}

/**
 * 한 페이지 — 다음 페이지 번호를 함께 돌려준다.
 * HTML 목록에는 MediaWiki 같은 토큰이 없어 **항목이 하나도 없을 때**를 끝으로 본다.
 * (범위를 넘긴 page 에 마지막 페이지를 다시 주는 사이트가 있어, 중복 판정은 호출부가 한다.)
 */
export async function listUsgsFeedPage(
  feedId: string = 'featured',
  limit: number = 24,
  page: number = 0,
): Promise<{ items: UsgsListItem[]; cont: number | null }> {
  const feed = USGS_FEEDS.find((f) => f.id === feedId) ?? USGS_FEEDS[0]!
  const res = await fetchWithTimeout(buildUsgsListUrl(feedId, page), { accept: 'text/html' })
  if (!res.ok) throw new Error(`USGS list fetch failed: ${res.status} ${feed.path}`)
  const html = await res.text()

  // c-usgs-teaser 컨테이너로 카드 분할 → 각 카드에서 slug/제목/teaser 추출.
  const cards = html.split(/<div class="[^"]*c-usgs-teaser/).slice(1)
  const seen = new Set<string>()
  const raw: UsgsListItem[] = []
  for (const card of cards) {
    const href = card.match(/\/news\/(?:featured-story|science-snippet)\/[a-z0-9-]+/i)?.[0]
    if (!href) continue
    const slug = href.split('/').pop()!
    if (slug === 'feed' || seen.has(slug)) continue

    const titleRaw = card.match(/<h[1-5][^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/h[1-5]>/i)?.[1]
    if (!titleRaw) continue
    const title = decodeEntities(stripTags(titleRaw)).replace(/\s+/g, ' ').trim()
    // 제목이 영문자로 시작하는 실 스토리만 (네비/플레이스홀더 제거).
    if (!title || !/^[A-Za-z]/.test(title)) continue

    const teaserRaw =
      card.match(/<div class="[^"]*d-teaser-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      card.match(/<p[^>]*>([\s\S]{30,}?)<\/p>/i)?.[1] ??
      ''
    const description = decodeEntities(stripTags(teaserRaw)).replace(/\s+/g, ' ').trim()

    seen.add(slug)
    raw.push({
      source_id: `usgs:${slug}`,
      title,
      url: `${SITE}${href}`,
      published_at: null, // 리스트에 발행일 없음 — 기사 fetch 시 확정
      description,
    })
  }

  return {
    items: applyArticleCurationSpec(raw.slice(0, limit * 2), 'usgs', feedId),
    cont: raw.length > 0 ? page + 1 : null,
  }
}

/** www.usgs.gov/news/featured-story|science-snippet/<slug> URL → RawArticle. */
export async function ingestUsgsArticle(itemUrl: string): Promise<RawArticle> {
  const url = itemUrl.startsWith('http')
    ? itemUrl
    : `${SITE}${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`
  const slug = url.match(/\/news\/(?:featured-story|science-snippet)\/([a-z0-9-]+)/i)?.[1]
  if (!slug) throw new Error(`USGS: slug 추출 실패 (${itemUrl})`)

  const res = await fetchWithTimeout(url, { accept: 'text/html' })
  if (!res.ok) throw new Error(`USGS fetch failed: ${res.status} ${url}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<title>([^<|]+)/i,
    ]) ?? '(제목 미상)'
  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<meta\s+name="date"\s+content="([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
  ])

  const content = extractProse(html)
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (words < 200) {
    throw new Error(`USGS body too short: ${words} words (${slug})`)
  }

  return {
    source: 'usgs',
    source_id: `usgs:${slug}`,
    source_url: url,
    title: decodeEntities(stripTags(title)).replace(/\s+/g, ' ').trim(),
    author: 'U.S. Geological Survey',
    language: 'en',
    license: 'Public Domain (US Government)', // PD US Gov → license_class=public_domain → 발행 허용
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null,
    audio_url: null,
    fetched_at: new Date(),
  }
}
