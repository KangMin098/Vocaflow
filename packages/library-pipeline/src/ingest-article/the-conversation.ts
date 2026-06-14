// packages/library-pipeline/src/ingest-article/the-conversation.ts
// ACP §18 (v06.35) — The Conversation ingester.
// v06.66 — listTheConversationFeed 추가 (대량 GET 지원).
//
// 학습 가치: 학자가 쓰는 논증문(argumentative) — CSAT 최난이도 지문 유형과 최유사. B2~C1.
// 라이선스: CC-BY-ND 4.0 — No Derivatives.
//   → license_class=cc_by_nd → DB 트리거가 display_only=true 설정.
//   → 본문은 verbatim 으로만 읽힘(attribution 필수), 단어세트 발행/구독 차단(파생물).
//     워크스페이스 단어 학습은 클릭 툴팁(lookup_word_meaning · 원문 불변)으로만.
//
// 본문 추출은 HTML 정규식(의존성 0) — 사이트 구조 변경 시 live-tune 필요.

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

// The Conversation 의 카테고리별 atom feed (전체/주제별).
export const THE_CONVERSATION_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'all',
    label: 'The Conversation — All articles',
    url: 'https://theconversation.com/articles.atom',
  },
  {
    id: 'science',
    label: 'The Conversation — Science + Tech',
    url: 'https://theconversation.com/topics/science-1391/articles.atom',
  },
  {
    id: 'health',
    label: 'The Conversation — Health + Medicine',
    url: 'https://theconversation.com/topics/health-39/articles.atom',
  },
  {
    id: 'politics',
    label: 'The Conversation — Politics + Society',
    url: 'https://theconversation.com/topics/politics-127/articles.atom',
  },
]

export interface TheConversationListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
  has_audio?: boolean
}

export async function listTheConversationFeed(
  feedUrl: string,
  feedId: string = 'all',
  _limit: number = 20,
): Promise<TheConversationListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`The Conversation atom fetch failed: ${res.status}`)
  const xml = await res.text()
  const raw = parseRssFeed(xml).map(toTheConversationItem)
  return applyArticleCurationSpec(raw, 'the_conversation', feedId)
}

function toTheConversationItem(it: RssListItem): TheConversationListItem {
  const slug = slugFromUrl(it.url) ?? hashString(it.url).toString(36)
  return {
    source_id: `the_conversation:${slug}`,
    title: it.title,
    url: it.url,
    published_at: it.published_at,
    description: it.description,
  }
}

/** 단일 The Conversation 기사 fetch — articleBody 추출. */
export async function ingestTheConversationArticle(itemUrl: string): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { accept: 'text/html' })
  if (!res.ok) throw new Error(`The Conversation fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<title>([^<]+?)(?:\s*[-|]\s*The Conversation)?<\/title>/i,
    ]) ?? '(제목 미상)'

  const author = extractFirst(html, [
    /<meta\s+name="author"\s+content="([^"]+)"/i,
    /<meta\s+property="article:author"\s+content="([^"]+)"/i,
  ])

  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
  ])

  // The Conversation 본문 = schema.org itemprop="articleBody" (<article> fallback).
  // 중첩 div 경계 한계로 itemprop 매치 실패 시 <article> 사용 — htmlToPlainText 가 내부 태그 정리.
  const bodyMatch =
    html.match(/itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/div>\s*<(?:footer|aside|div[^>]+(?:republish|disclosure))/i) ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    html.match(/itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/div>/i)
  const content = htmlToPlainText(bodyMatch?.[1] ?? html)

  if (content.trim().length < 300) {
    throw new Error(`The Conversation body too short: ${content.trim().length} chars`)
  }

  const slug = slugFromUrl(itemUrl) ?? hashString(itemUrl).toString(36)

  return {
    source: 'the_conversation',
    source_id: `the_conversation:${slug}`,
    source_url: itemUrl,
    title: decodeEntities(title).trim(),
    author: author ? decodeEntities(author).trim() : 'The Conversation',
    language: 'en',
    license: 'CC-BY-ND-4.0', // → license_class=cc_by_nd → display_only
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}

function slugFromUrl(url: string): string | null {
  // theconversation.com/<slug>-<numericId>
  const m = url.match(/theconversation\.com\/(?:[a-z-]+\/)?([a-z0-9\-]+?)(?:\?|#|$)/i)
  return m?.[1]?.slice(0, 60) ?? null
}
