// packages/library-pipeline/src/ingest-article/nih.ts
// ACP v1.0 Phase 19 — NIH article ingester
//
// NIH 컨텐츠 = U.S. federal government work = Public Domain.
// MedlinePlus 는 NLM(NIH) 산하 — 동일 PD.
//
// Feeds:
//   - NIH News Releases: https://www.nih.gov/news-events/news-releases/feed.xml
//   - MedlinePlus Health News (EN): https://medlineplus.gov/feeds/news_en.xml
//   - Director's Blog: https://directorsblog.nih.gov/feed/
//
// source_id 형식: 'nih:<slug>'

import type { RawArticle } from '../types-article'

import {
  decodeEntities,
  extractFirst,
  fetchWithTimeout,
  hashString,
  htmlToPlainText,
  parseRssFeed,
  type RssListItem,
} from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

// NOTE: URL 검증 (2026-06-01):
//   - NIH News Releases: nih.gov/news-releases/feed.xml — **현재 403 IP 차단** (server-side fetch 거부)
//     → UI 에 "URL 직접 입력 사용" 안내
//   - MedlinePlus What's New: feeds/whatsnew.xml — 200 OK (안정)
//   - Director's Blog: directorsblog.nih.gov/feed/ — TLS handshake 이슈 가능
// v06.34 — 작동 가능한 feed 만 default 노출. nih.gov news 는 우회 안내.
export const NIH_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'medlineplus',
    label: "MedlinePlus What's New (안정)",
    url: 'https://medlineplus.gov/feeds/whatsnew.xml',
  },
  {
    id: 'directors-blog',
    label: "NIH Director's Blog",
    url: 'https://directorsblog.nih.gov/feed/',
  },
  {
    id: 'news',
    label: 'NIH News Releases (현재 차단됨 · URL 직접 입력)',
    url: 'https://www.nih.gov/news-releases/feed.xml',
  },
]

export interface NihListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  /** v06.41 — 학습 친화도 score */
  score?: ArticleScore
  /** v06.45 — audio 보유 여부 (NIH 대부분 false) */
  has_audio?: boolean
}

export async function listNihFeed(
  feedUrl: string,
  feedId: string = 'medlineplus',
  _limit: number = 20,
): Promise<NihListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`NIH RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const raw = parseRssFeed(xml).map(toNihItem)
  return applyArticleCurationSpec(raw, 'nih', feedId)
}

function toNihItem(it: RssListItem): NihListItem {
  const slug = slugFromUrl(it.url) ?? (it.guid ? slugFromGuid(it.guid) : hashString(it.url).toString(36))
  return {
    source_id: `nih:${slug}`,
    title: it.title,
    url: it.url,
    published_at: it.published_at,
    description: it.description,
  }
}

/**
 * 단일 NIH article fetch — body 추출.
 * nih.gov 는 <div class="usa-prose">, medlineplus 는 <article>, blog 는 <article> 사용.
 */
export async function ingestNihArticle(itemUrl: string): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { accept: 'text/html' })
  if (!res.ok) throw new Error(`NIH article fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<meta\s+name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+?)(?:\s*[-|]\s*(?:NIH|MedlinePlus))?<\/title>/i,
    ]) ?? '(제목 미상)'

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<meta\s+name="dc.date"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // 본문 후보: usa-prose (nih.gov) → article (medlineplus / blog) → main
  const bodyMatch =
    html.match(/<div[^>]*class="[^"]*usa-prose[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  const content = htmlToPlainText(bodyMatch?.[1] ?? html)

  if (content.trim().length < 200) {
    throw new Error(`NIH article body too short: ${content.trim().length} chars`)
  }

  const slug = slugFromUrl(itemUrl) ?? hashString(itemUrl).toString(36)
  const isMedlinePlus = /medlineplus\.gov/i.test(itemUrl)

  return {
    source: 'nih',
    source_id: `nih:${slug}`,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: isMedlinePlus ? 'MedlinePlus / NLM' : 'NIH',
    language: 'en',
    license: 'PD-Government',
    published_at: publishedAt ? new Date(publishedAt) : null,
    content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}

// ─── helpers ─────────────────────────────────────

function slugFromUrl(url: string): string | null {
  const m = url.match(/\/([a-z0-9\-]+?)(?:\.html?)?\/?(?:\?|$)/i)
  return m?.[1] ?? null
}

function slugFromGuid(guid: string): string {
  const m = guid.match(/([a-z0-9\-]+)\/?$/i)
  return m?.[1] ?? guid.replace(/[^a-z0-9\-]/gi, '').slice(0, 40)
}
