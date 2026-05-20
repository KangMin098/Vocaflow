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

// NOTE: URL 검증 (2026-05-20):
//   - NIH News Releases: nih.gov/news-releases/feed.xml  (NOT news-events/news-releases/feed.xml — 404)
//   - MedlinePlus What's New: feeds/whatsnew.xml  (news_en.xml 은 존재 X)
//   - Director's Blog: directorsblog.nih.gov/feed/ — WordPress 표준 (안정적)
export const NIH_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'news',
    label: 'NIH News Releases',
    url: 'https://www.nih.gov/news-releases/feed.xml',
  },
  {
    id: 'medlineplus',
    label: "MedlinePlus What's New",
    url: 'https://medlineplus.gov/feeds/whatsnew.xml',
  },
  {
    id: 'directors-blog',
    label: "NIH Director's Blog",
    url: 'https://directorsblog.nih.gov/feed/',
  },
]

export interface NihListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
}

export async function listNihFeed(feedUrl: string, limit = 20): Promise<NihListItem[]> {
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`NIH RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  return parseRssFeed(xml).slice(0, limit).map(toNihItem)
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
