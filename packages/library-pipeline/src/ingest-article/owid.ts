// packages/library-pipeline/src/ingest-article/owid.ts
// ACP §18 확장 (T-2) — Our World in Data ingester.
//
// 학습 가치: 데이터 기반 논증문(argumentative) — CSAT 최난이도 지문 유형과 최유사. B2~C1.
//   register 갭 보강: 유일한 argumentative 소스 the_conversation 이 CC-BY-ND(display_only,
//   단어세트 미발행)라, OWID(CC-BY = 파생 허용)가 argumentative register 를 **발행 가능**
//   콘텐츠로 채운다.
// 라이선스: CC BY 4.0 — 본문 산문 페이지 명시 "License: CC BY" (실측 P0-1c).
//   3rd-party 데이터만 개별 라이선스(본문 산문 아님). → license_class=cc_by → display_only 아님.
// 본문 추출: HTML 정규식(의존성 0) + grapher 차트 div 제거 후 산문화 → `stripOwidChrome`.
//   페이지 껍데기(머리 내비게이션·뉴스레터 폼·감사말·관련글)는 **마크업이 아니라 텍스트 블록**이라
//   같은 `<article>` 안에 본문과 형제로 들어 있다. 그래서 평문 단계에서 걷어낸다 — 규칙과
//   두 함정은 아래 `stripOwidChrome` 주석 참조(문자열만 고치면 본문이 파괴된다).
//   사이트 구조 변경 시 live-tune 필요 (the-conversation.ts 와 동일 계약).

import type { RawArticle } from '../types-article'

import {
  decodeEntities,
  extractFirst,
  fetchWithTimeout,
  hashString,
  htmlToPlainText,
  parseRssFeed,
  safeDate,
  type RssListItem,
} from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

// OWID atom feed (실측 P0-1a: 유효 · 10 entry). topic-pages feed 는 404 → all 단일.
export const OWID_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'all',
    label: 'Our World in Data — All articles',
    url: 'https://ourworldindata.org/atom.xml',
  },
]

export interface OwidListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

export async function listOwidFeed(
  feedUrl: string = OWID_FEEDS[0]!.url,
  feedId: string = 'all',
  _limit: number = 20,
): Promise<OwidListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`OWID atom fetch failed: ${res.status}`)
  const xml = await res.text()
  const raw = parseRssFeed(xml).map(toOwidItem)
  return applyArticleCurationSpec(raw, 'owid', feedId)
}

function toOwidItem(it: RssListItem): OwidListItem {
  const slug = slugFromUrl(it.url) ?? hashString(it.url).toString(36)
  return {
    source_id: `owid:${slug}`,
    title: it.title,
    url: it.url,
    published_at: it.published_at,
    description: it.description,
  }
}

/** 단일 OWID 기사 fetch — 산문 본문(차트/grapher/표 제외) 추출. */
export async function ingestOwidArticle(itemUrl: string): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { accept: 'text/html' })
  if (!res.ok) throw new Error(`OWID fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<title>([^<]+?)(?:\s*[-|]\s*Our World in Data)?<\/title>/i,
    ]) ?? '(제목 미상)'

  const author = extractFirst(html, [
    /<meta\s+name="author"\s+content="([^"]+)"/i,
    /<meta\s+property="article:author"\s+content="([^"]+)"/i,
  ])

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // 본문 = <article>. grapher 차트/figure/표 제거 후 산문화.
  //   실측 P0-1b: <article>×1 · grapher div 예 3 · figure/iframe/table 초기 HTML 0.
  const artMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  let body = artMatch?.[1] ?? html
  body = body.replace(/<figure[\s\S]*?<\/figure>/gi, '\n')
  body = body.replace(/<div[^>]*class="[^"]*grapher[^"]*"[\s\S]*?<\/div>/gi, '\n')
  body = body.replace(/<div[^>]*data-grapher[^>]*>[\s\S]*?<\/div>/gi, '\n')
  body = body.replace(/<table[\s\S]*?<\/table>/gi, '\n')
  const content = stripOwidChrome(htmlToPlainText(body))

  if (content.trim().length < 300) {
    throw new Error(`OWID body too short: ${content.trim().length} chars`)
  }

  const slug = slugFromUrl(itemUrl) ?? hashString(itemUrl).toString(36)

  return {
    source: 'owid',
    source_id: `owid:${slug}`,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: author ? decodeEntities(author).trim() : 'Our World in Data',
    language: 'en',
    license: 'CC-BY-4.0', // → license_class=cc_by → 단어세트 발행 허용(display_only 아님)
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null, // analyze 단계 실측 (§4-D 소스 일괄 CEFR 금지)
    audio_url: null,
    fetched_at: new Date(),
  }
}

// ── OWID 페이지 껍데기 제거 (v06.211 재작성) ────────────────────────────────
// 평문(htmlToPlainText 이후) 단계에서 돈다 — 껍데기가 마크업이 아니라 **텍스트 블록**이라
// HTML 구조로는 본문과 구분되지 않는다(같은 `<article>` 안에 형제로 들어 있다).
//
// ⚠️ 함정 ① — **머리와 꼬리에 같은 문자열이 있다.**
//   v06.210 코드는 `Endnotes|Cite this work|Reuse this work freely` 를 찾아 **최초 발생**에서
//   잘랐는데, 이 사이트의 실제 문자열은 `Cite this article` · `Reuse our work freely` 다
//   (`Endnotes` 는 13편 중 0회 — 이 사이트에 없는 마커). 즉 **한 번도 발동한 적이 없는 죽은 코드**였고,
//   적재된 13편이 100% 오염 상태였다.
//   그래서 **"문자열만 실제 값으로 맞추면 되겠네" 가 이 결함의 재발 경로다.** 두 문자열은 페이지
//   **맨 위**(`Home<주제>` + 부제 + `By …` + 날짜 + `Browse past versions` 뒤, 본문의 1~11%
//   지점 · 실측 최대 388자)에도 오기 때문이다. 13편 전수 시뮬레이션(2026-09-06):
//     · `\b` 를 남긴 채 문자열만 교체 → 13편 전부 여전히 매치 0 (죽은 코드 그대로)
//     · `\b` 를 떼면 → **5편이 본문 44~54어로 파괴**(896→50 · 1,512→54 · 455→45 · 759→44 · 1,576→46).
//       나머지 8편은 머리 마커가 300자 안이라 `index > 300` 가드에 걸려 아무것도 안 잘린다.
//   즉 순진한 수정은 **일부는 파괴하고 일부는 그대로 두어** 원인을 더 찾기 어렵게 만든다.
//   → **머리는 「제거」, 꼬리는 「절단」으로 갈라야 한다.** 문자열이 아니라 규칙이 틀렸던 것이다.
//
// ⚠️ 함정 ② — **`Acknowledgments` · `Continue reading on Our World in Data` 는 꼬리가 아닐 수 있다.**
//   보통은 84~97% 지점에 오지만, 「farm animals」 편은 둘 다 **28~29% 지점**에 있고 그 뒤
//   `Appendix 1: Common farming practices` 이하 2,066어가 정상 산문이다. 최초 발생 절단 시
//   2,970→809어(73% 손실). **마지막 발생에서 잘라도 마찬가지다** — 이 편은 두 마커가 나란히
//   앞쪽에 있고 뒤에는 마커가 없다.
//   → 위치나 순서로는 못 가른다. **뒤에 산문이 남아 있는가**로 가른다(아래 PROSE_AHEAD_WORDS).
//     실측: 꼬리 영역의 잔여 어수는 13편 최대 **123어**, farm animals 의 부록은 **2,400어** — 마진 충분.

/** 머리 껍데기 — `Home<주제>`부터 인용·라이선스 안내까지. 13/13 이 900자 안에서 끝난다(실측 최대 388자). */
const OWID_HEAD_SHELL = /^[\s\S]{0,900}?Reuse (?:our|this) work freely[ \t]*\n+/

/** 뉴스레터 구독 폼 — 꼬리가 아니라 **본문 한복판(20~87%)** 에 끼어든다. 9/13. */
const OWID_NEWSLETTER = /\n[ \t]*Subscribe to our newsletters?[ \t]*\n[\s\S]{0,400}?\n[ \t]*Subscribe[ \t]*\n+/g

/** 껍데기 마커 — 여기가 꼬리인지 본문 중간 위젯인지는 **문자열이 아니라 뒤에 남은 산문량**이 정한다. */
const OWID_CHROME =
  /\n[ \t]*(?:Acknowledge?ments?|Endnotes|Continue reading on Our World in Data|Cite this article|Cite this work|Reuse our work freely|Reuse this work freely)[ \t]*\n/

/** 마커 뒤에 이만큼 산문이 남아 있으면 꼬리가 아니다 — 블록만 도려내고 뒤를 살린다(함정 ②). */
const OWID_PROSE_AHEAD_WORDS = 300

/** 본문 문단으로 인정하는 한 줄의 어수. 관련글 설명은 최대 38어였고 본문 문단은 44~98어다. */
const OWID_PARAGRAPH_WORDS = 40

/** 소제목으로 보는 줄 — 짧고 문장부호로 끝나지 않는다(`Appendix 1: Common farming practices`). */
const OWID_HEADING_WORDS = 14

function lineWords(line: string): number {
  const t = line.trim()
  return t ? t.split(/\s+/).length : 0
}

function proseWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
}

/** 관련글/감사말 블록이 끝나고 본문이 다시 시작하는 offset. 없으면 null. */
function findProseResume(after: string): number | null {
  let offset = 0
  let headingOffset: number | null = null
  for (const line of after.split('\n')) {
    const n = lineWords(line)
    // 문단을 만나면 거기가 본문 — 바로 앞 소제목이 있으면 그 소제목부터 살린다.
    if (n >= OWID_PARAGRAPH_WORDS) return headingOffset ?? offset
    // 빈 줄은 소제목 기억을 지우지 않는다(소제목과 문단 사이에 빈 줄이 올 수 있다).
    if (n > 0) {
      headingOffset = n <= OWID_HEADING_WORDS && !/[.?!]$/.test(line.trim()) ? offset : null
    }
    offset += line.length + 1
  }
  return null
}

/** OWID 페이지 껍데기(머리·뉴스레터·관련글·꼬리) 제거. 평문을 받아 평문을 돌려준다. */
export function stripOwidChrome(input: string): string {
  let text = input.replace(/\r\n?/g, '\n')

  // 1) 머리 — 잘라내는 게 아니라 **앞에서 걷어낸다**. 본문이 300자도 안 남으면 페이지 구조가
  //    바뀐 것이므로 손대지 않는다(파괴보다 오염이 낫다 — 오염은 다음 실측에서 보이지만
  //    파괴된 본문은 `body too short` 로 조용히 사라진다).
  const head = text.match(OWID_HEAD_SHELL)
  if (head && text.length - head[0].length >= 300) text = text.slice(head[0].length)

  // 2) 본문 중간 뉴스레터 폼
  text = text.replace(OWID_NEWSLETTER, '\n\n')

  // 3) 껍데기 마커 — 뒤에 산문이 남았으면 블록만 도려내고, 안 남았으면 거기가 페이지 끝이다.
  let out = ''
  let rest = text
  for (;;) {
    const m = rest.match(OWID_CHROME)
    if (m?.index == null) break
    const before = rest.slice(0, m.index)
    const after = rest.slice(m.index + m[0].length)
    if (proseWords(after) < OWID_PROSE_AHEAD_WORDS) {
      rest = before // 꼬리 — 절단
      break
    }
    const resume = findProseResume(after)
    out += `${before}\n\n`
    rest = resume == null ? after : after.slice(resume) // 블록만 제거
  }

  return `${out}${rest}`.replace(/\n{3,}/g, '\n\n').trim()
}

function slugFromUrl(url: string): string | null {
  // ourworldindata.org/<slug>
  const m = url.match(/ourworldindata\.org\/([a-z0-9-]+?)(?:\?|#|$)/i)
  return m?.[1]?.slice(0, 60) ?? null
}
