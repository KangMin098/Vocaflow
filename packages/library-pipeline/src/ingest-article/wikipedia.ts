// packages/library-pipeline/src/ingest-article/wikipedia.ts
// ACP §18 — English Wikipedia (정규) ingester.
//
// Simple English Wikipedia 와 동일 MediaWiki action API(_mediawiki 공용) — host 만 en.wikipedia.org.
// 라이선스: 본문 CC-BY-SA (Wikipedia) → license_class=cc_by_sa → 학습 가공/발행 허용.
// 난이도: 정규 Wikipedia ≈ B2~C1 (Simple 의 A2-B1 보다 어려움 — 고급 다독). analyze 자동 감지.
// register 기본: expository. 후보 = FA(Featured)·GA(Good) 카테고리(품질 검수분).

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { ingestMediaWikiArticle } from './_mediawiki'

const API_BASE = 'https://en.wikipedia.org/w/api.php'

// FA/GA = 커뮤니티 품질 검수 카테고리 (junk 배제 · Simple 의 very-good/good 대응).
export const WIKIPEDIA_FEEDS: Array<{ id: string; label: string; category: string }> = [
  { id: 'featured', label: 'Featured Articles (Wikipedia)', category: 'Category:Featured articles' },
  { id: 'good', label: 'Good Articles (Wikipedia)', category: 'Category:Good articles' },
]

export interface WikipediaListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
  has_audio?: boolean
}

interface MediaWikiPage {
  pageid: number
  title: string
  extract?: string
  fullurl?: string
  touched?: string
}
interface MediaWikiQueryResponse {
  query?: { pages?: Record<string, MediaWikiPage> }
}

/** Wikipedia 카테고리 페이지 목록 + intro extract (categorymembers generator). */
export async function listWikipediaFeed(
  category: string,
  feedId: string = 'good',
  limit: number = 30,
): Promise<WikipediaListItem[]> {
  const url = new URL(API_BASE)
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'categorymembers')
  url.searchParams.set('gcmtitle', category)
  url.searchParams.set('gcmlimit', String(Math.min(limit, 50)))
  url.searchParams.set('gcmtype', 'page')
  url.searchParams.set('gcmnamespace', '0') // 주 기사(ns=0)만 — 관리 페이지 배제
  url.searchParams.set('prop', 'extracts|info')
  url.searchParams.set('exintro', '1')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('exchars', '320')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('format', 'json')

  const res = await fetchWithTimeout(url.toString(), { accept: 'application/json' })
  if (!res.ok) throw new Error(`Wikipedia API fetch failed: ${res.status}`)
  const data = (await res.json()) as MediaWikiQueryResponse
  const pages = Object.values(data.query?.pages ?? {})

  const raw: WikipediaListItem[] = pages
    .filter((p) => (p.extract ?? '').trim().length >= 60)
    .map((p) => {
      const slug = (p.title ?? '').replace(/\s+/g, '_').slice(0, 80)
      return {
        source_id: `wikipedia:${slug}`,
        title: p.title,
        url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
        published_at: p.touched ?? null,
        description: (p.extract ?? '').trim(),
      }
    })

  return applyArticleCurationSpec(raw, 'wikipedia', feedId)
}

/** en.wikipedia.org/wiki/<Title> URL 또는 제목 → RawArticle. */
export async function ingestWikipediaArticle(input: string): Promise<RawArticle> {
  return ingestMediaWikiArticle({
    apiBase: API_BASE,
    siteBase: 'https://en.wikipedia.org/wiki/',
    source: 'wikipedia',
    license: 'CC-BY-SA-4.0',
    author: 'English Wikipedia contributors',
    input,
  })
}
