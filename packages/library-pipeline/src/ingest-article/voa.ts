// packages/library-pipeline/src/ingest-article/voa.ts
// ACP v1.0 Phase 18 — VOA Learning English article ingester
//
// VOA Learning English: 미국의 소리 (U.S. federal government) — Public Domain.
// CEFR 3단계 등급 콘텐츠 (Level 1/2/3) 제공 — 학습 친화적 짧은 뉴스/스크립트.
//
// RSS feed:
//   https://learningenglish.voanews.com/api/zrgoqe$omp     (As It Is, Level 2-3)
//   https://learningenglish.voanews.com/api/zptp_e-p_t     (Science & Technology)
//   https://learningenglish.voanews.com/api/zjroyeuvy_     (Words and Their Stories, Level 3)
//   ... (각 카테고리별 RSS — VOA 가 RSS URL 직접 제공)
//
// source_id 형식: 'voa:<article_id>' 또는 URL slug
// MVP 동작: RSS 1개 카테고리 fetch → item N 개 → 각 item URL → HTML → transcript 추출

import type { RawArticle } from '../types-article'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

// VOA WAF 는 비브라우저 UA (curl/bot) 를 403 차단 → 일반 브라우저 UA 로 fetch.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15_000
const MAX_ITEMS_PER_FEED = 20

/** VOA RSS feed 목록 — 카테고리별. id 는 admin UI 에서 선택. */
export const VOA_FEEDS: Array<{ id: string; label: string; level: 1 | 2 | 3; url: string }> = [
  {
    id: 'as-it-is',
    label: 'As It Is (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/api/zrgoqe$omp',
  },
  {
    id: 'words-and-their-stories',
    label: 'Words and Their Stories (Level 3)',
    level: 3,
    url: 'https://learningenglish.voanews.com/api/zjroyeuvy_',
  },
  {
    id: 'science-technology',
    label: 'Science & Technology (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/api/zptp_e-p_t',
  },
  {
    id: 'lets-learn-english',
    label: "Let's Learn English (Level 1)",
    level: 1,
    url: 'https://learningenglish.voanews.com/api/zmgqee$lpi',
  },
]

/**
 * RSS feed 의 최근 article N개 가져오기 (메타만 — 본문은 별도 fetch).
 * v06.41 — 큐레이션 spec 적용: 필터 + score + sort + top N (_curation-spec.ts)
 */
export interface VoaListItem {
  source_id: string // voa:<guid>
  title: string
  url: string
  published_at: string | null
  description: string
  /** 학습 친화도 score (0~1) + breakdown — v06.41 큐레이션 spec */
  score?: ArticleScore
}

export async function listVoaFeed(
  feedUrl: string,
  feedId: string = 'as-it-is',
  _limit: number = MAX_ITEMS_PER_FEED,
): Promise<VoaListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) {
    throw new Error(`VOA RSS fetch failed: ${res.status}`)
  }
  const xml = await res.text()
  const raw = parseRssItems(xml)
  return applyArticleCurationSpec(raw, 'voa', feedId)
}

/**
 * 단일 VOA article fetch — RawArticle 반환 (ACP 파이프라인 입력).
 */
export async function ingestVoaArticle(itemUrl: string, hintLevel?: 1 | 2 | 3): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { Accept: 'text/html' })
  if (!res.ok) throw new Error(`VOA article fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title = extractFirst(html, [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<meta\s+name="title"\s+content="([^"]+)"/i,
    /<title>([^<]+?)(?:\s*\|\s*VOA)?<\/title>/i,
  ]) ?? '(제목 미상)'

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // VOA 본문: <div class="wsw"> (their wysiwyg 본문 컨테이너) 또는 <article>
  const bodyMatch =
    html.match(/<div[^>]*class="[^"]*wsw[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  const bodyHtml = bodyMatch?.[1] ?? html
  const content = htmlToPlainText(bodyHtml)

  if (content.trim().length < 200) {
    throw new Error(`VOA article body too short: ${content.trim().length} chars`)
  }

  // source_id: URL 의 마지막 슬러그
  const slugMatch = itemUrl.match(/\/([a-z0-9\-]+)\/?(?:\?|$)/i)
  const sourceId = `voa:${slugMatch?.[1] ?? hashString(itemUrl).toString(36)}`

  return {
    source: 'voa',
    source_id: sourceId,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: 'VOA Learning English',
    language: 'en',
    license: 'PD-Government',
    published_at: publishedAt ? new Date(publishedAt) : null,
    content,
    estimated_cefr: hintLevel ? VOA_LEVEL_TO_CEFR[hintLevel] : null,
    fetched_at: new Date(),
  }
}

const VOA_LEVEL_TO_CEFR: Record<1 | 2 | 3, string> = {
  1: 'A2',
  2: 'B1',
  3: 'B2',
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseRssItems(xml: string): VoaListItem[] {
  const items: VoaListItem[] = []
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]!
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const guid = extractTag(block, 'guid')
    const pubDate = extractTag(block, 'pubDate')
    const desc = extractTag(block, 'description')

    if (!link) continue
    items.push({
      source_id: guid ? `voa:${slugFromGuid(guid)}` : `voa:${hashString(link).toString(36)}`,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      url: link.trim(),
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
      description: decodeEntities(stripTags(desc ?? '')).trim().slice(0, 400),
    })
  }
  return items
}

function extractTag(block: string, tag: string): string | undefined {
  // CDATA 와 일반 텍스트 모두 지원
  const re = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i')
  const m = block.match(re)
  return (m?.[1] ?? m?.[2])?.trim()
}

function extractFirst(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function slugFromGuid(guid: string): string {
  const m = guid.match(/([a-z0-9\-]+)\/?$/i)
  return m?.[1] ?? guid.replace(/[^a-z0-9\-]/gi, '').slice(0, 40)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}

async function fetchWithTimeout(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, text/html',
        ...extraHeaders,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
