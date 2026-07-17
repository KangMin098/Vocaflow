// packages/library-pipeline/src/ingest-article/wikivoyage.ts
// ACP §18 — Wikivoyage (여행 가이드) ingester.
//
// Wikimedia 프로젝트 → Wikipedia 와 동일 MediaWiki action API(_mediawiki 공용). host 만 en.wikivoyage.org.
// 라이선스: CC-BY-SA (Wikivoyage) → license_class=cc_by_sa → 발행 허용.
// 난이도: 여행 가이드 산문 ≈ B1~B2 (백과보다 평이·실용). analyze 자동 감지.
// register: reference — 목적지 안내(Factbook 국가개요와 동류). 얇은 reference 밴드 보강.
// 후보 = Star(최고품질)·Guide(가이드급) 카테고리.

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { ingestMediaWikiArticle } from './_mediawiki'

const API_BASE = 'https://en.wikivoyage.org/w/api.php'

export const WIKIVOYAGE_FEEDS: Array<{ id: string; label: string; category: string }> = [
  { id: 'star', label: 'Star Articles (Wikivoyage)', category: 'Category:Star articles' },
  { id: 'guide', label: 'Guide Articles (Wikivoyage)', category: 'Category:Guide articles' },
]

export interface WikivoyageListItem {
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

/** Wikivoyage 카테고리 목적지 목록 + intro extract. */
export async function listWikivoyageFeed(
  category: string,
  feedId: string = 'star',
  limit: number = 30,
): Promise<WikivoyageListItem[]> {
  const url = new URL(API_BASE)
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'categorymembers')
  url.searchParams.set('gcmtitle', category)
  url.searchParams.set('gcmlimit', String(Math.min(limit * 2, 100)))
  url.searchParams.set('gcmtype', 'page')
  url.searchParams.set('gcmnamespace', '0')
  url.searchParams.set('gcmsort', 'timestamp') // 최근 승격 — 다양한 목적지 (sortkey 편중 회피)
  url.searchParams.set('gcmdir', 'desc')
  url.searchParams.set('prop', 'extracts|info')
  url.searchParams.set('exintro', '1')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('exchars', '320')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('format', 'json')

  const res = await fetchWithTimeout(url.toString(), { accept: 'application/json' })
  if (!res.ok) throw new Error(`Wikivoyage API fetch failed: ${res.status}`)
  const data = (await res.json()) as MediaWikiQueryResponse
  const pages = Object.values(data.query?.pages ?? {})

  const raw: WikivoyageListItem[] = pages
    .filter((p) => (p.extract ?? '').trim().length >= 60 && /^[A-Za-z]/.test((p.title ?? '').trim()))
    .slice(0, limit)
    .map((p) => {
      const slug = (p.title ?? '').replace(/\s+/g, '_').slice(0, 80)
      return {
        source_id: `wikivoyage:${slug}`,
        title: p.title,
        url: p.fullurl ?? `https://en.wikivoyage.org/wiki/${encodeURIComponent(slug)}`,
        published_at: p.touched ?? null,
        description: (p.extract ?? '').trim(),
      }
    })

  return applyArticleCurationSpec(raw, 'wikivoyage', feedId)
}

/** en.wikivoyage.org/wiki/<Title> URL 또는 제목 → RawArticle. */
export async function ingestWikivoyageArticle(input: string): Promise<RawArticle> {
  return ingestMediaWikiArticle({
    apiBase: API_BASE,
    siteBase: 'https://en.wikivoyage.org/wiki/',
    source: 'wikivoyage',
    license: 'CC-BY-SA-4.0',
    author: 'Wikivoyage contributors',
    input,
  })
}
