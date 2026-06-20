// packages/library-pipeline/src/ingest-article/wikinews.ts
// ACP §18 (v06.35) — Wikinews ingester.
// v06.66 — listWikinewsFeed 추가 (대량 GET 지원).
//
// MediaWiki action API plain-text extract (공용 _mediawiki).
// 라이선스: 본문 CC-BY 2.5 (Wikinews) → license_class=cc_by → 학습 가공 허용.
// 난이도: A2~B2 시사(news). register 기본: news.

import type { RawArticle } from '../types-article'

import {
  fetchWithTimeout,
  hashString,
  parseRssFeed,
  type RssListItem,
} from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { ingestMediaWikiArticle } from './_mediawiki'

// v06.66 — Special:NewsFeed deprecated (404). MediaWiki feedrecentchanges atom 사용.
//   namespace=0 (main articles) 만 필터링 — User/Talk/Template 노이즈 제외.
//   주의: 영문 Wikinews 가 실질적으로 거의 비활성 상태 (30일 이내 article 0건 흔함).
export const WIKINEWS_FEEDS: Array<{ id: string; label: string; url: string }> = [
  {
    id: 'latest',
    label: 'Wikinews — Latest news (※ 현재 거의 비활성)',
    url: 'https://en.wikinews.org/w/api.php?action=feedrecentchanges&feedformat=atom&namespace=0&hidebots=1&hideminor=1&hideanons=1&days=30&limit=30',
  },
]

export interface WikinewsListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
  has_audio?: boolean
}

export async function listWikinewsFeed(
  feedUrl: string,
  feedId: string = 'latest',
  _limit: number = 24,
): Promise<WikinewsListItem[]> {
  void _limit
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) throw new Error(`Wikinews RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const raw = parseRssFeed(xml).map(toWikinewsItem)
  return applyArticleCurationSpec(raw, 'wikinews', feedId)
}

function toWikinewsItem(it: RssListItem): WikinewsListItem {
  // Wikinews atom guid 가 보통 article URL — slug 추출.
  // feedrecentchanges 의 url 은 보통 wiki/PageName + 가끔 &oldid=... — slug = PageName.
  const slug =
    it.url.match(/\/wiki\/([^?#]+)/)?.[1] ??
    (it.guid ? it.guid.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) : null) ??
    hashString(it.url).toString(36)
  return {
    source_id: `wikinews:${slug}`,
    title: it.title,
    url: it.url,
    published_at: it.published_at,
    description: it.description,
  }
}

/** en.wikinews.org/wiki/<Title> URL 또는 제목 → RawArticle. */
export async function ingestWikinewsArticle(input: string): Promise<RawArticle> {
  return ingestMediaWikiArticle({
    apiBase: 'https://en.wikinews.org/w/api.php',
    siteBase: 'https://en.wikinews.org/wiki/',
    source: 'wikinews',
    license: 'CC-BY-2.5',
    author: 'Wikinews contributors',
    input,
    minLen: 150, // 시사 기사는 짧을 수 있음
  })
}
