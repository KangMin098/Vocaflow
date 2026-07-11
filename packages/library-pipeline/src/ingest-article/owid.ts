// packages/library-pipeline/src/ingest-article/owid.ts
// ACP §18 확장 (T-2) — Our World in Data ingester.
//
// 학습 가치: 데이터 기반 논증문(argumentative) — CSAT 최난이도 지문 유형과 최유사. B2~C1.
//   register 갭 보강: 유일한 argumentative 소스 the_conversation 이 CC-BY-ND(display_only,
//   단어세트 미발행)라, OWID(CC-BY = 파생 허용)가 argumentative register 를 **발행 가능**
//   콘텐츠로 채운다.
// 라이선스: CC BY 4.0 — 본문 산문 페이지 명시 "License: CC BY" (실측 P0-1c).
//   3rd-party 데이터만 개별 라이선스(본문 산문 아님). → license_class=cc_by → display_only 아님.
// 본문 추출: HTML 정규식(의존성 0) + grapher 차트 div 제거 후 산문화.
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
  let content = htmlToPlainText(body)
  // OWID 페이지 말미 트레일러 절단(v06.210) — 각주(Endnotes)·BibTeX 인용(Cite this work)·
  //   라이선스 안내(Reuse this work freely)가 본문·어휘 추출을 오염시켜 제거. 본문 뒤 최초 마커에서 컷.
  const trailer = content.match(/\n[ \t]*(?:Endnotes|Cite this work|Reuse this work freely)\b/)
  if (trailer?.index != null && trailer.index > 300) {
    content = content.slice(0, trailer.index).trim()
  }

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

function slugFromUrl(url: string): string | null {
  // ourworldindata.org/<slug>
  const m = url.match(/ourworldindata\.org\/([a-z0-9-]+?)(?:\?|#|$)/i)
  return m?.[1]?.slice(0, 60) ?? null
}
