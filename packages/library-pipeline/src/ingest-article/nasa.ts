// packages/library-pipeline/src/ingest-article/nasa.ts
// ACP v1.0 Phase 19 — NASA article ingester
//
// NASA 컨텐츠 = U.S. federal government work = Public Domain (저작권 X).
// 인용 시 NASA 출처 표기 권장 (예의상, 법적 의무 X).
//
// Feeds:
//   - News Releases:  https://www.nasa.gov/news-release/feed/
//   - APOD (천문일사진): https://apod.nasa.gov/apod.rss
//   - Image of the Day: https://www.nasa.gov/feeds/iotd-feed/
//
// source_id 형식: 'nasa:<slug>' (URL 마지막 path segment)

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

export const NASA_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'news',
    label: 'NASA News Releases',
    url: 'https://www.nasa.gov/news-release/feed/',
  },
  {
    id: 'apod',
    label: 'Astronomy Picture of the Day',
    url: 'https://apod.nasa.gov/apod.rss',
  },
  {
    id: 'iotd',
    label: 'Image of the Day',
    url: 'https://www.nasa.gov/feeds/iotd-feed/',
  },
]

export interface NasaListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  /** v06.41 — 학습 친화도 score */
  score?: ArticleScore
  /** v06.45 — audio 보유 여부 (NASA news 일부 mp3) */
  has_audio?: boolean
}

/**
 * NASA 뉴스 피드는 WordPress 라 `?paged=N` 으로 과거 글이 나온다.
 * 실측 2026-08-30: 기본 10편 · `?paged=2` 와 `?paged=5` 가 각각 다른 10편을 돌려줬다.
 * (`iotd` 는 paged 를 무시하고 창 전체 60편을 준다 — 그래서 페이지를 걸 필요가 없다.)
 */
export function nasaFeedUrlPaged(feedUrl: string, page: number): string {
  if (page <= 1) return feedUrl
  try {
    const u = new URL(feedUrl)
    u.searchParams.set('paged', String(page))
    return u.toString()
  } catch {
    return feedUrl
  }
}

/**
 * @param limit 최대 편수. VOA 와 같은 이유로 예전에는 버려졌다(`void _limit`) — 생략하면
 *   큐레이션 spec 의 `maxItems` 그대로이고, 넘기면 그 값이 상한이 된다.
 */
export async function listNasaFeed(
  feedUrl: string,
  feedId: string = 'news',
  limit?: number,
): Promise<NasaListItem[]> {
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`NASA RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  // v06.45 — RSS item 별 body 에 mp3 있는지 detect (NASA news 가끔)
  const itemBlocks = xml.match(/<item\b[^>]*>([\s\S]*?)<\/item>/g) ?? []
  const audioByLink = new Map<string, boolean>()
  for (const block of itemBlocks) {
    const link = block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim()
    if (!link) continue
    const hasEncAudio = /<enclosure[^>]+type="audio\//.test(block)
    const hasBodyMp3 = /https?:[^\s<>"']+\.mp3/.test(block)
    if (hasEncAudio || hasBodyMp3) audioByLink.set(link, true)
  }
  const raw = parseRssFeed(xml).map(toNasaItem).map((it) => ({
    ...it,
    has_audio: audioByLink.get(it.url) ?? false,
  }))
  return applyArticleCurationSpec(raw, 'nasa', feedId, { maxItems: limit })
}

function toNasaItem(it: RssListItem): NasaListItem {
  const slug = slugFromUrl(it.url) ?? (it.guid ? slugFromGuid(it.guid) : hashString(it.url).toString(36))
  return {
    source_id: `nasa:${slug}`,
    title: it.title,
    url: it.url,
    published_at: it.published_at,
    description: it.description,
  }
}

/**
 * 단일 NASA article fetch — body 추출.
 * APOD 은 explanation 단락 추출, 일반 nasa.gov 페이지는 article/main 본문.
 */
/**
 * NASA 쪽에서 발행 시각을 찾는 자리 — **쪽 종류마다 다른 이름에 담긴다** (실측 2026-09-02).
 *
 * 처음엔 `article:published_time` 과 `<time datetime>` 둘만 봤다. 기사 쪽에는 있지만
 * `image-article`·`image-detail` 쪽에는 **둘 다 없다.** 그래서 우리가 가진 NASA 초·중 지문
 * 110편 중 **92편이 발행일 없음**으로 들어와 있었다 — 원문 축 B5(발행일 명시율 15.8%)가
 * 이걸 잡아냈다. 그 쪽들이 날짜를 안 싣는 게 아니라 다른 이름으로 싣는다:
 *
 *     image-article   parsely-pub-date + og:updated_time
 *     image-detail    og:updated_time 만
 *
 * **순서가 뜻을 정한다** — 앞의 셋은 *발행* 시각이고 `og:updated_time` 은 *고친* 시각이라
 * 발행일과 다를 수 있다. 그래서 맨 뒤에 둔다. 없는 것보다 낫지만 같은 값은 아니다.
 *
 * 목록으로 빼 둔 것은 **망 없이 회귀 테스트를 걸기 위해서**다 — 함수 안에 인라인으로 두면
 * 이 결함을 재현하려면 NASA 를 실제로 두드려야 한다.
 */
export const NASA_DATE_PATTERNS: RegExp[] = [
  /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
  /<meta\s+name="parsely-pub-date"\s+content="([^"]+)"/i,
  /<time[^>]*datetime="([^"]+)"/i,
  /<meta\s+property="og:updated_time"\s+content="([^"]+)"/i,
]

/** 본문 하한 — 세척 뒤 이 길이를 못 넘기면 거절한다. 꼬리 절단 안전판도 이 값을 쓴다. */
const NASA_MIN_BODY_CHARS = 200

// ─────────────────────────────────────────────
// 본문 세척 (v06.46 · 실측 2026-09-06)
// ─────────────────────────────────────────────
//
// ⚠️⚠️ **순서가 뜻을 정한다 — 머리를 먼저 확정하고, 꼬리는 그 뒤에서만 찾는다.** ⚠️⚠️
//
//   photojournal 쪽(`science.nasa.gov/photojournal/*`)의 본문 컨테이너는 실제로 이 순서다:
//
//       Downloads → <제목> → JPEG (2.44 MB) → <제목> → TIFF (43.89 MB) → Description → 본문
//
//   즉 `Downloads`·`PNG (n MB)` 같은 다운로드 껍데기가 **본문보다 앞**에 있다. 이것을
//   "꼬리 표지" 로 보고 먼저 자르면 **본문 전체가 사라진다.** 사전 시뮬레이션 1차에서
//   실제로 **38편이 200자 미만으로 떨어져** 통째로 버려졌다. 그래서 이 파일의 세척은
//   반드시 ① 머리 절단 → ② 꼬리 절단 순서로만 돈다. 두 단계를 바꾸지 말 것.
//
// 두 번째 함정: **바이라인 이름 줄을 따로 지우면 안 된다.** `^[A-Z][a-z]+( [A-Z][a-z.]+){1,3}$`
//   모양의 단독 줄이 본문 한복판에 **433회** 나온다(인용 귀속·인명 목록). 머리 절단이
//   표지 줄 앞을 통째로 버리므로 바이라인은 거기서 자동으로 사라진다 — 별도 규칙 금지.
//
// 세 번째 함정: `X Navigation` 은 **본문에 실제로 있었다** —
//   "Theriot created a Field Navigation Exercise at Challenger 7 Memorial Park".
//   그래서 단독 줄 + 첫 3줄로만 제한한다. 문장 안 매치는 절대 금지.

/**
 * `_helpers.ts` 의 `decodeOnce` 가 다루지 않는 named entity.
 * ⚠️ 공용 헬퍼를 고치지 않고 **여기서** 처리한다 — 다른 원천이 같은 함수를 공유한다.
 * 실측: 원본 수확 422편 중 **79편**에 미해독 엔티티가 남아 있었다(`&hellip;` 194회 최다).
 */
const NASA_EXTRA_ENTITIES: Array<[RegExp, string]> = [
  [/&hellip;/g, '…'],
  [/&rsquo;/g, '’'],
  [/&lsquo;/g, '‘'],
  [/&ldquo;/g, '“'],
  [/&rdquo;/g, '”'],
  [/&mdash;/g, '—'],
  [/&ndash;/g, '–'],
  [/&oacute;/g, 'ó'],
  [/&eacute;/g, 'é'],
]

/** 줄 통째로 버리는 것 — 문장이 아니라 UI 안내문. 위치와 무관하게 지운다. */
const NASA_DROP_LINES: RegExp[] = [
  /^To view this video please enable JavaScript\b.*$/i,
  /^.*consider upgrading to a web browser that.*$/i,
  /^Lee esta historia en español\b.*$/i,
]

/**
 * 머리 표지 — 비어 있지 않은 첫 30줄 안에서 찾아 **그 줄까지** 버린다.
 * 전부 **단독 줄**로만 매치한다(문장 안 낱말일 수 있는 `Description` 때문).
 */
const NASA_HEAD_MARKERS: RegExp[] = [
  /^(?:Image )?Article$/,
  /^Description$/,
  /^(?:MEDIA ADVISORY|RELEASE|STATUS REPORT|NOTE TO EDITORS)\s*[MN]?\d{2}-\d{2,4}$/,
]

/** APOD 마스트헤드 — `Explanation:` **이후**가 본문이다(같은 줄의 나머지를 살린다). */
const NASA_APOD_HEAD = /^Explanation:\s*/

const HEAD_WINDOW_LINES = 30
/** `N min read` 는 머리 구역에만 있다 — 문장 안 `\b\d+ min read\b` 가 63건 있었다. */
const MIN_READ_WINDOW_LINES = 13
/** `X Navigation` 은 첫 3줄 한정 — 본문 문장을 죽이지 않기 위해. */
const NAV_WINDOW_LINES = 3

const NASA_MIN_READ_LINE = /^\d+\s*min read$/i
const NASA_NAV_LINE = /^[A-Z][A-Za-z]*(?: [A-Za-z]+){0,3} Navigation$/

/**
 * 꼬리 표지 — 가장 이른 것부터 끝까지 버린다. 전부 **단독 줄**.
 * ⚠️ `Downloads` 는 여기 없다 — photojournal 에서 본문 **앞**에 오기 때문(위 함정 참조).
 */
const NASA_TAIL_MARKERS: RegExp[] = [
  /^About the Author$/,
  /^Last Updated:?$/,
  /^Related Terms:?$/,
  /^Explore More$/,
  /^Keep Exploring$/,
  /^DownloadShare$/,
  /^Tomorrow['’]s picture:.*$/,
  /^Random APOD Generator$/,
  /^References & Resources$/,
  /^More Images of the Day:?$/,
  /^Instruments:$/,
  /^Topics:$/,
  // 사이트 이전 안내 — APOD 미러 본문 끝에 한 줄로 붙는다(실측 2026-09-06).
  /^APOD['’]s main NASA site is moving:/,
  // NASA 보도자료의 관용 종결 부호 — 뒤는 기자 연락처(이름·전화·메일)뿐이다.
  // 실측 2026-09-06 `news-release/nasa-ames-fire-department-aircraft-firefighting-training`.
  /^-end-$/,
]

/** 두 줄이 이어져야 꼬리인 것 — 한 줄만으로는 본문 낱말일 수 있다. */
const NASA_TAIL_PAIRS: Array<[RegExp, RegExp]> = [
  [/^Share$/, /^Details$/],
  [/^Read More$/, /^Facebook$/],
]

// ⚠️ `Downloads` 를 "뒷구역에서만 꼬리" 로 두는 안을 만들었다가 **버렸다**(2026-09-06).
//    earth-observatory 는 본문 **뒤**에 다운로드 블록(`Downloads / 날짜 / JPEG (1.49 MB)`)을
//    두므로 3줄이 남는다. 그걸 지우려면 photojournal(본문 **앞**에 같은 블록)과 위치로
//    갈라야 하는데, `entry-content` 를 못 찾아 `<article>` 로 물러난 photojournal 쪽에서는
//    앞 껍데기가 200자를 넘어 안전판을 통과한다 → **본문 대신 껍데기만 남는다.**
//    남는 3줄보다 그 사고가 비싸다. 잔여물로 두고 간다.

/**
 * 본문 컨테이너를 고른다.
 *
 * **③ 컨테이너 선택이 정규식 절단보다 오탐이 적다** — 그래서 이쪽을 먼저 쓴다.
 * 실측 2026-09-06 (라이브 5쪽: news-release · image-article · earth-observatory ·
 * photojournal · science.nasa.gov APOD 미러 + 골든셋 fixture): 여섯 쪽 모두
 * `<div class="entry-content">` 하나가 본문을 감싸고 있었고, 읽기시간·크레딧·바이라인·
 * 공유버튼·"Explore More" 추천 카드는 **전부 그 밖**에 있었다. `<article>` 통짜는 그것들을
 * 전부 삼킨다(= 원본 398편 100% 오염의 원인).
 *
 * ⚠️ 클래스는 **토큰 일치**로 본다 — `form-entry-content` 가 같은 쪽에 있어서
 * `[^"]*entry-content` 로 쓰면 폼 껍데기를 본문으로 고른다.
 *
 * 컨테이너가 없거나(구형 apod.nasa.gov 등) 그 안에 산문이 부족하면 `<article>`→`<main>`
 * 으로 물러난다. **길이로 고르지 않는다** — NOAA 에서 "가장 긴 조각이 본문" 휴리스틱이
 * 껍데기를 골라 기사를 조용히 버렸다(`noaa-body-selection.test.ts`).
 */
export function pickNasaBodyHtml(html: string): string {
  for (const inner of entryContentBlocks(html)) {
    if (cleanNasaBody(htmlToPlainText(inner)).length >= NASA_MIN_BODY_CHARS) return inner
  }
  const fallback =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  return fallback?.[1] ?? html
}

/** `class` 에 `entry-content` 토큰을 가진 `<div>` 의 내부 HTML 을 문서 순서로 돌려준다. */
function* entryContentBlocks(html: string): Generator<string> {
  const open = /<div\b[^>]*\bclass="(?:[^"]*\s)?entry-content(?:\s[^"]*)?"[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = open.exec(html))) {
    const start = m.index + m[0].length
    // `<div>` 는 중첩된다 — 첫 `</div>` 로 자르면 본문이 잘린다. 깊이를 센다.
    const scan = /<div\b[^>]*>|<\/div\s*>/gi
    scan.lastIndex = start
    let depth = 1
    let s: RegExpExecArray | null
    let end = html.length
    while ((s = scan.exec(html))) {
      if (s[0][1] === '/') {
        depth -= 1
        if (depth === 0) {
          end = s.index
          break
        }
      } else {
        depth += 1
      }
    }
    yield html.slice(start, end)
  }
}

/**
 * 평문 본문에서 NASA 템플릿 껍데기를 걷어낸다.
 *
 * 순서: 엔티티 → 줄 삭제 → **머리 절단** → 머리 구역 잔여물 → **꼬리 절단**.
 * ⚠️ 머리와 꼬리를 바꾸면 photojournal 본문이 통째로 사라진다(위 함정 블록).
 */
export function cleanNasaBody(text: string): string {
  let out = text
  for (const [re, ch] of NASA_EXTRA_ENTITIES) out = out.replace(re, ch)

  let lines = out.split('\n').map((l) => l.trim())
  lines = lines.filter((l) => !NASA_DROP_LINES.some((re) => re.test(l)))

  // ── ① 머리 절단 (반드시 먼저) ────────────────────────────
  const headWindow = windowEnd(lines, HEAD_WINDOW_LINES)
  let cutFrom = 0
  let apodPrefixAt = -1
  for (let i = 0; i < headWindow; i++) {
    const line = lines[i]
    if (!line) continue
    if (NASA_HEAD_MARKERS.some((re) => re.test(line))) {
      cutFrom = i + 1 // 표지 줄까지 버린다
      apodPrefixAt = -1
    } else if (NASA_APOD_HEAD.test(line)) {
      cutFrom = i // 같은 줄의 나머지가 본문 첫 문장이다
      apodPrefixAt = i
    }
  }
  if (apodPrefixAt >= 0) {
    lines[apodPrefixAt] = (lines[apodPrefixAt] ?? '').replace(NASA_APOD_HEAD, '')
  }
  lines = lines.slice(cutFrom)

  // ── 머리 구역 잔여물 (절단이 못 걷은 경우에만 남는다) ─────
  const minReadEnd = windowEnd(lines, MIN_READ_WINDOW_LINES)
  const navEnd = windowEnd(lines, NAV_WINDOW_LINES)
  lines = lines.filter((l, i) => {
    if (i < minReadEnd && NASA_MIN_READ_LINE.test(l)) return false
    if (i < navEnd && NASA_NAV_LINE.test(l)) return false
    return true
  })

  // ── ② 꼬리 절단 (머리가 확정된 뒤에만) ───────────────────
  for (let i = 0; i < lines.length; i++) {
    if (!isTailMarker(lines, i)) continue
    const kept = lines.slice(0, i).join('\n').trim()
    // 안전판: 표지가 본문 앞쪽에 잘못 걸리면 자르지 않고 다음 후보를 본다.
    // (본문이 통째로 날아가는 사고는 조용해서 — 짧아진 글은 "원래 짧은 글" 로 보인다.)
    if (kept.length >= NASA_MIN_BODY_CHARS) {
      lines = lines.slice(0, i)
      break
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function isTailMarker(lines: string[], i: number): boolean {
  const line = lines[i]
  if (!line) return false
  if (NASA_TAIL_MARKERS.some((re) => re.test(line))) return true
  const next = lines.slice(i + 1).find((l) => l.length > 0)
  return NASA_TAIL_PAIRS.some(([a, b]) => a.test(line) && next !== undefined && b.test(next))
}

/** 비어 있지 않은 줄 `n` 개를 포함하는 지점의 인덱스(빈 줄은 창을 소모하지 않는다). */
function windowEnd(lines: string[], n: number): number {
  let seen = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) seen += 1
    if (seen >= n) return i + 1
  }
  return lines.length
}

export async function ingestNasaArticle(itemUrl: string): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { accept: 'text/html' })
  if (!res.ok) throw new Error(`NASA article fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<meta\s+name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+?)(?:\s*[-|]\s*NASA)?<\/title>/i,
    ]) ?? '(제목 미상)'

  const publishedAt = extractFirst(html, NASA_DATE_PATTERNS)

  // APOD 페이지: <b>Explanation:</b> 아래 본문이 다음 <p> 까지
  const isApod = /apod\.nasa\.gov/i.test(itemUrl)
  let content: string
  if (isApod) {
    const explMatch = html.match(/Explanation:[\s\S]*?<\/b>([\s\S]*?)<p>/i)
    content = htmlToPlainText(explMatch?.[1] ?? html)
  } else {
    content = htmlToPlainText(pickNasaBodyHtml(html))
  }
  // 컨테이너로 걸러도 남는 것이 있다(science.nasa.gov 의 APOD 미러는 마스트헤드와
  // "Tomorrow's picture:" 꼬리가 `entry-content` **안**에 있다). 두 층으로 막는다.
  content = cleanNasaBody(content)

  if (content.trim().length < NASA_MIN_BODY_CHARS) {
    throw new Error(`NASA article body too short: ${content.trim().length} chars`)
  }

  const slug = slugFromUrl(itemUrl) ?? hashString(itemUrl).toString(36)

  return {
    source: 'nasa',
    source_id: `nasa:${slug}`,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: isApod ? 'NASA APOD' : 'NASA',
    language: 'en',
    license: 'PD-Government',
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null, // NASA 는 학습자 등급 없음 — analyze 단계에서 자동 감지
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────

function slugFromUrl(url: string): string | null {
  // /news-release/some-slug/ 또는 /apod/ap240519.html 등에서 slug 추출
  const m = url.match(/\/([a-z0-9\-]+?)(?:\.html?)?\/?(?:\?|$)/i)
  return m?.[1] ?? null
}

function slugFromGuid(guid: string): string {
  const m = guid.match(/([a-z0-9\-]+)\/?$/i)
  return m?.[1] ?? guid.replace(/[^a-z0-9\-]/gi, '').slice(0, 40)
}
