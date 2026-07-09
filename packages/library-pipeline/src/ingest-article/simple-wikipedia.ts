// packages/library-pipeline/src/ingest-article/simple-wikipedia.ts
// ACP §18 (v06.35) — Simple English Wikipedia ingester.
// v06.66 — listSimpleWikipediaFeed (MediaWiki API categorymembers) 추가.
//
// MediaWiki action API plain-text extract (공용 _mediawiki). RSS 없음.
// 라이선스: 본문 CC-BY-SA (Wikipedia) → license_class=cc_by_sa → 학습 가공 허용.
// 난이도: Simple English Wikipedia ≈ A2~B1 (analyze 단계 자동 감지).
// register 기본: expository (정의문은 reference 로 재분류 가능 — DB register 컬럼).

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { ingestMediaWikiArticle } from './_mediawiki'

// Simple Wikipedia 카테고리별 — generator=categorymembers + extract 한 번에.
const API_BASE = 'https://simple.wikipedia.org/w/api.php'
export const SIMPLE_WIKIPEDIA_FEEDS: Array<{ id: string; label: string; category: string }> = [
  {
    id: 'very-good',
    label: 'Very Good Articles (Simple Wikipedia)',
    category: 'Category:Very_good_articles',
  },
  {
    id: 'good',
    label: 'Good Articles (Simple Wikipedia)',
    category: 'Category:Good_articles',
  },
]

export interface SimpleWikipediaListItem {
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
  query?: {
    pages?: Record<string, MediaWikiPage>
  }
}

/**
 * Simple Wikipedia 카테고리 페이지 목록 + 첫 paragraph extract.
 *
 * @param category 'Category:Very_good_articles' 같은 카테고리 풀 타이틀
 * @param feedId   spec lookup 용 ('very-good' | 'good')
 */
export async function listSimpleWikipediaFeed(
  category: string,
  feedId: string = 'good',
  limit: number = 30,
): Promise<SimpleWikipediaListItem[]> {
  const url = new URL(API_BASE)
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'categorymembers')
  url.searchParams.set('gcmtitle', category)
  url.searchParams.set('gcmlimit', String(Math.min(limit, 50)))
  url.searchParams.set('gcmtype', 'page')
  // ns=0(주 기사)만 — 카테고리에 섞인 Wikipedia:/Category: 등 관리 페이지 배제.
  //   (gcmtype=page 는 전 네임스페이스 포함 → 'Wikipedia:Good articles/by date' 등 junk 유입 방지)
  url.searchParams.set('gcmnamespace', '0')
  url.searchParams.set('prop', 'extracts|info')
  url.searchParams.set('exintro', '1')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('exchars', '320')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('format', 'json')

  const res = await fetchWithTimeout(url.toString(), {
    accept: 'application/json',
  })
  if (!res.ok) {
    throw new Error(`Simple Wikipedia API fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as MediaWikiQueryResponse
  const pages = Object.values(data.query?.pages ?? {})

  // v06.67 — extract 가 빈 페이지(특수문자 제목 등 일부 비활성 페이지)는 사전 제외.
  //   list 단계 score 가드(minDescriptionLen=60) 통과율 ↑.
  const raw: SimpleWikipediaListItem[] = pages
    .filter((p) => (p.extract ?? '').trim().length >= 60)
    .map((p) => {
      const slug = (p.title ?? '').replace(/\s+/g, '_').slice(0, 80)
      return {
        source_id: `simple_wikipedia:${slug}`,
        title: p.title,
        url: p.fullurl ?? `https://simple.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
        published_at: p.touched ?? null,
        description: (p.extract ?? '').trim(),
      }
    })

  return applyArticleCurationSpec(raw, 'simple_wikipedia', feedId)
}

/** simple.wikipedia.org/wiki/<Title> URL 또는 제목 → RawArticle. */
export async function ingestSimpleWikipediaArticle(input: string): Promise<RawArticle> {
  return ingestMediaWikiArticle({
    apiBase: API_BASE,
    siteBase: 'https://simple.wikipedia.org/wiki/',
    source: 'simple_wikipedia',
    license: 'CC-BY-SA-4.0',
    author: 'Simple English Wikipedia contributors',
    input,
  })
}
