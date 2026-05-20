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
  type RssListItem,
} from './_helpers'

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
}

export async function listNasaFeed(feedUrl: string, limit = 20): Promise<NasaListItem[]> {
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`NASA RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  return parseRssFeed(xml).slice(0, limit).map(toNasaItem)
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

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // APOD 페이지: <b>Explanation:</b> 아래 본문이 다음 <p> 까지
  const isApod = /apod\.nasa\.gov/i.test(itemUrl)
  let content: string
  if (isApod) {
    const explMatch = html.match(/Explanation:[\s\S]*?<\/b>([\s\S]*?)<p>/i)
    content = htmlToPlainText(explMatch?.[1] ?? html)
  } else {
    // nasa.gov 일반: <article> 또는 <main> 본문
    const bodyMatch =
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
      html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
    content = htmlToPlainText(bodyMatch?.[1] ?? html)
  }

  if (content.trim().length < 200) {
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
    published_at: publishedAt ? new Date(publishedAt) : null,
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
