// packages/library-pipeline/src/ingest-article/futurity.ts
//
// **Futurity — 대학이 자기 연구를 직접 대중화한 기사.** CC BY 4.0.
//
// ── 왜 이 소스인가 (실측 2026-08-21) ─────────────────────────────────
// 교재 지문 재고에는 두 종류의 구멍이 있었다. 하나는 논증문(→ `plos.ts` 의 essay 피드),
// 다른 하나는 **"학술 소재인데 읽히는 문장"** 이다. 기존 재고는 양극단이었다:
//   VOA·NASA  평균 488~881단어 · 쉽지만 소재가 학술이 아니다
//   PLOS·위키  평균 5,600~7,300단어 · 소재는 맞지만 C1–C2 라 중·고등에 못 쓴다
// Futurity 는 **원문이 논문인 연구를 대학 공보가 기자용으로 풀어 쓴 글**이라
// 소재는 학술인데 문장은 읽힌다 — 수능 지문의 소재-문체 조합에 가장 가깝다.
//
// 길이는 실측 **평균 585단어 · 15문단**(표본 6편)으로, 어느 축에서도 "중간" 이 아니라
// **VOA(881)보다도 짧다.** 처음에 "PLOS 와 VOA 사이" 로 적었다가 실측에서 틀렸다.
// 짧은 것은 흠이 아니다 — 한 편이 한 단원에 맞는 크기라 조합기가 원글을 덜 쪼갠다.
//
// ── 라이선스 (실측으로 확인한 것) ────────────────────────────────────
// **기사 페이지**에 "You are free to share this article under the Attribution 4.0
// International license" 가 박혀 있다 = CC BY 4.0 → `license_class=cc_by` → 발행·변형 허용.
//
// ⚠️ **about 페이지에는 "All rights reserved" 가 있다** (사이트 크롬). 2026-08-21 에
//   about 을 보고 restricted 로 판정할 뻔했다. 라이선스는 **기사 페이지**에서 확인한다.
//
// URL: https://www.futurity.org/<slug>-<id>/
// source_id: "futurity:<slug>-<id>"

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

export const FUTURITY_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'all',
    label: 'Futurity — 대학 연구 기사 (전체)',
    url: 'https://www.futurity.org/feed/',
  },
]

export interface FuturityListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

/** RSS 항목의 추적 파라미터를 뗀다 — 안 떼면 같은 글이 다른 source_id 로 두 번 들어온다. */
function cleanUrl(url: string): string {
  return url.replace(/[?&]utm_[^&]*/g, '').replace(/\?$/, '')
}

function slugFromUrl(url: string): string | null {
  return cleanUrl(url).match(/futurity\.org\/([a-z0-9-]+)\/?$/i)?.[1] ?? null
}

function toFuturityItem(it: RssListItem): FuturityListItem {
  const url = cleanUrl(it.url)
  const slug = slugFromUrl(url) ?? hashString(url).toString(36)
  return {
    source_id: `futurity:${slug}`,
    title: it.title,
    url,
    published_at: it.published_at,
    description: it.description,
  }
}

export async function listFuturityFeed(
  feedUrl: string = FUTURITY_FEEDS[0]!.url,
  feedId: string = 'all',
  _limit: number = 20,
): Promise<FuturityListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`Futurity RSS fetch failed: ${res.status}`)
  const raw = parseRssFeed(await res.text()).map(toFuturityItem)
  return applyArticleCurationSpec(raw, 'futurity', feedId)
}

/**
 * class 정규식에 맞는 첫 `<div>` 의 inner HTML 을 깊이 추적으로 잘라 낸다.
 *
 * 정규식 한 방으로 `<div ...>([\s\S]*?)</div>` 를 쓰면 **첫 번째 닫는 태그**에서 끊겨
 * 본문 앞부분만 나온다. 중첩 div 가 흔한 워드프레스 테마에서는 반드시 깊이를 센다.
 * (`plos.ts` 가 같은 이유로 같은 함수를 갖고 있다.)
 */
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
      depth += w[0]!.startsWith('</') ? -1 : 1
      if (depth === 0) return html.slice(start, w.index)
    }
    return html.slice(start)
  }
  return null
}

/**
 * 본문 앞뒤의 사이트 크롬을 뗀다.
 *
 * 실측(2026-08-21)한 페이지 순서는 이렇다:
 *   제목 · 날짜 · "Posted by <대학>" · (Credit: …) · Share this Article · SNS 4개 ·
 *   "You are free to share this article under the Attribution 4.0 International license." ·
 *   **Topic · Tags · <태그들> · University · <대학명>** ← 여기까지가 크롬 ·
 *   → 본문 → 끝에 "Source: <대학>"
 *
 * ⚠️ 라이선스 문장만 경계로 삼았다가 **머리 크롬이 남았다**(실측: 지문이
 *   "Topic --> --> Tags families University Michigan State University Researchers have…"
 *   로 시작했다). 태그 목록이 지문에 섞이면 문항 생성기가 그것을 첫 문단으로 세고,
 *   순서·삽입 문항의 정답이 조용히 틀어진다.
 *
 * 그래서 문자열 자르기가 아니라 **문단 블록 단위**로 뗀다. `University` 라벨과
 * 그 다음 블록(대학명)까지가 크롬이고, 그 뒤부터 본문이다. 라벨이 없으면
 * 라이선스 문장 뒤부터를 본문으로 본다 — 못 찾았다고 빈 본문을 만들지 않는다.
 */
export function stripFuturityChrome(text: string): string {
  const licenseMark =
    /free to share this article under the Attribution [\d.]+ International license\.?/i
  const m = text.match(licenseMark)
  const afterLicense = m ? text.slice(text.indexOf(m[0]) + m[0].length) : text

  const blocks = afterLicense
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  // `University` 라벨 뒤 블록이 대학명이고, 본문은 그 다음부터다.
  // 라벨은 크롬 구역에만 나오므로 앞쪽 8블록 안에서만 찾는다 — 본문에 같은 단어가
  // 한 줄로 나오는 경우까지 잘라 내면 지문 앞부분을 잃는다.
  const labelIdx = blocks.findIndex((b, i) => i < 8 && /^University$/i.test(b))
  let body = labelIdx >= 0 ? blocks.slice(labelIdx + 2) : blocks

  // 꼬리 — 출처 표기 · 원논문 DOI · 관련기사 목록은 지문이 아니다.
  //
  // ⚠️ 블록 단위로만 떼려다 **놓쳤다**(실측): 꼬리가
  //   "Source: <대학>\nOriginal Study\n DOI: …\n\nRelated\n\n<관련기사 제목들>"
  // 라서 앞 두 줄이 **한 블록**이고, 그 뒤 관련기사가 별도 블록으로 이어진다.
  // 마지막 블록만 검사하면 관련기사 제목이 지문 본문으로 남아 — 문항 생성기가
  // 그것을 마지막 문단으로 세고 순서·삽입 문항의 정답이 조용히 틀어진다.
  //
  // 그래서 꼬리는 **표식이 나온 지점부터 끝까지** 자른다.
  //
  // ⚠️ 처음엔 "뒤쪽 40% 안의 표식만 인정" 하는 비율 휴리스틱을 썼는데,
  //   **짧은 글에서 표식이 60% 앞에 놓여 통째로 빠졌다**(테스트가 잡았다).
  //   비율은 글 길이에 따라 뜻이 달라지므로 경계로 쓸 값이 아니다.
  //   대신 **줄 첫머리**를 쓴다 — 산문 문단이 "Source:" 로 시작하는 일은 없고,
  //   이 표식들은 전부 자기 줄을 차지하는 구조물이다. 길이와 무관하게 성립한다.
  const joined = body.join('\n\n')
  const cut = [/^Source:\s/im, /^Original Study\s*$/im, /^Related\s*$/im]
    .map((re) => joined.match(re)?.index ?? -1)
    .filter((i) => i >= 0)
  return (cut.length ? joined.slice(0, Math.min(...cut)) : joined).trim()
}

/** 단일 Futurity 기사 → 산문 추출. */
export async function ingestFuturityArticle(itemUrl: string): Promise<RawArticle> {
  const url = cleanUrl(itemUrl)
  const res = await fetchWithTimeout(url, { accept: 'text/html' })
  if (!res.ok) throw new Error(`Futurity article fetch failed: ${res.status} ${url}`)
  const rawHtml = await res.text()
  const html = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<title>([^<]+?)(?:\s*[-–|]\s*Futurity)?<\/title>/i,
    ]) ?? '(제목 미상)'

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // 기사 본문 컨테이너. 워드프레스 테마의 `class="article"` 이 정본이고,
  // ajax 목록 래퍼(`alm-single-post`)는 같은 내용에 id 가 하나 더 붙어 있어 차선이다.
  const inner =
    sliceDivByClass(html, /(?:^|\s)article(?:\s|$)/) ??
    sliceDivByClass(html, /alm-single-post/)
  if (!inner) throw new Error(`Futurity: 본문 컨테이너를 못 찾았다 (${url})`)

  const content = stripFuturityChrome(htmlToPlainText(inner))
  if (content.length < 200) {
    throw new Error(`Futurity article body too short: ${content.length} chars (${url})`)
  }

  // "Posted by <대학>" 이 저자다 — 기자 이름이 아니라 연구를 낸 기관이다.
  const university = extractFirst(html, [/rel="author"[^>]*>([^<]+)</i, /Posted by\s+([^<\n]{2,60})/i])

  return {
    source: 'futurity',
    source_id: `futurity:${slugFromUrl(url) ?? hashString(url).toString(36)}`,
    source_url: url,
    title: decodeEntities(title).trim(),
    author: university ? `Futurity / ${decodeEntities(university).trim()}` : 'Futurity',
    language: 'en',
    // 기사 페이지에서 확인한 값. about 페이지의 "All rights reserved" 는 사이트 크롬이다.
    license: 'CC-BY-4.0',
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null, // analyze 단계가 판정한다
    fetched_at: new Date(),
  }
}
