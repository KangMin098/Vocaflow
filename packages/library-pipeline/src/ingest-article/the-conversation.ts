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
import { ShortBodyError } from './short-body'

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
  // ⚠️ 2026-08-19 — `topics/<슬러그>-<번호>` 형태를 전부 걷었다. **셋 다 엉뚱한 주제를
  //   가져오고 있었다.** 해소되는 것은 번호이고 슬러그는 장식인데, The Conversation 이
  //   그 번호의 주제명을 바꾸면서 우리 피드가 조용히 다른 주제가 됐다(실측 301 추적):
  //
  //     topics/science-1391  → topics/molecular-biology-1391
  //     topics/health-39     → topics/transport-39      (건강 라벨인데 교통)
  //     topics/politics-127  → topics/nbn-127           (정치 라벨인데 광대역망)
  //
  //   기사는 계속 들어오고 영어이고 라이선스도 같아서 **아무 경보도 안 울린다.**
  //   그래서 번호가 없는 **섹션 경로**만 쓴다 — 이름이 곧 주소라 바뀌면 404 로 드러난다.
  //   회귀 테스트가 `topics/…-숫자` 형태를 금지한다.
  {
    id: 'science',
    // 이 주소는 스스로를 "Science + Tech – The Conversation" 이라 부른다(실측 피드 제목).
    label: 'The Conversation — Science + Tech',
    url: 'https://theconversation.com/us/technology/articles.atom',
  },
  {
    id: 'health',
    label: 'The Conversation — Health + Medicine',
    url: 'https://theconversation.com/us/health/articles.atom',
  },
  {
    // politics 는 되살리지 않는다 — 이 서비스가 일부러 피하는 소재이고(사건·정치),
    //   실측 부적합률도 높은 축이었다. 대신 가장 높게 나온 섹션을 넣는다.
    id: 'education',
    label: 'The Conversation — Education (적합률 실측 64.0%)',
    url: 'https://theconversation.com/us/education/articles.atom',
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

  // The Conversation 본문 = schema.org itemprop="articleBody".
  //
  // ── 왜 div 를 세는가 (실측 2026-09-23, 기사 6편) ─────────────────────
  // 정규식 셋으로 되어 있었고 **1순위는 지금도 잘 맞는다**(6/6, 어수 967~1,404).
  // 문제는 그 뒤 둘이다 — 1순위가 빗나간 기사에서 조용히 나빠진다:
  //   `<article>` fallback   사이드바까지 먹는다        956어 본문 → **1,125어**(+18%)
  //   `</div>` 최소 매치     첫 닫힘에서 끊는다         956어 본문 → **256어**(27%)
  // 둘 다 오류를 내지 않고 **그럴듯한 값**을 돌려주므로 아무도 모른다.
  // 그래서 추측하는 대신 **여는/닫는 div 를 세어 정확한 경계**를 찾는다.
  const body = extractArticleBody(html)
  const content = htmlToPlainText(body ?? html)

  // 짧아도 버리지 않는다 — 기사를 다 만든 뒤 `ShortBodyError` 로 들고 나간다(short-body.ts).
  const shortBody = content.trim().length < 300

  const slug = slugFromUrl(itemUrl) ?? hashString(itemUrl).toString(36)

  const article: RawArticle = {
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
  if (shortBody) {
    throw new ShortBodyError(`The Conversation body too short: ${content.trim().length} chars`, {
      source: article.source,
      url: article.source_url,
      content: article.content,
      article,
    })
  }
  return article
}

/**
 * `itemprop="articleBody"` 구간을 **div 깊이를 세어** 정확히 잘라낸다.
 *
 * 정규식으로는 못 한다 — 중첩은 정규 언어가 아니다. 최소 매치는 첫 `</div>` 에서 끊고,
 * 최대 매치는 본문 뒤 사이드바까지 먹는다. 둘 다 **오류 없이 그럴듯한 값**을 낸다.
 *
 * 못 찾으면 `null` 을 돌려준다 — 호출부가 전체 HTML 로 물러서고, 그러면 길이 검사에
 * 걸려 시끄럽게 실패한다. **조용히 틀린 본문을 내놓는 것보다 낫다.**
 */
export function extractArticleBody(html: string): string | null {
  const open = html.match(/itemprop=["']articleBody["'][^>]*>/i)
  if (!open) return null
  const start = (open.index ?? 0) + open[0].length
  let depth = 1
  const tag = /<div\b[^>]*>|<\/div\s*>/gi
  tag.lastIndex = start
  let m: RegExpExecArray | null
  while ((m = tag.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) return html.slice(start, m.index)
  }
  // 닫히지 않은 채 끝났다 — 잘린 HTML 이다. 끝까지 주고 길이 검사에 맡긴다.
  return html.slice(start)
}

function slugFromUrl(url: string): string | null {
  // theconversation.com/<slug>-<numericId>
  const m = url.match(/theconversation\.com\/(?:[a-z-]+\/)?([a-z0-9\-]+?)(?:\?|#|$)/i)
  return m?.[1]?.slice(0, 60) ?? null
}
