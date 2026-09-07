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
  /** MediaWiki 연속 토큰 — 키가 여럿이고 모듈마다 다르다(gcmcontinue · excontinue …). */
  continue?: Record<string, string | number>
}

/**
 * 다음 페이지 토큰. **키 하나가 아니라 `continue` 객체 통째다.**
 * `gcmcontinue` 만 읽으면 첫 왕복에서 null 이 나와 소진으로 오인한다(아래 주석 참조).
 */
export type WikipediaCursor = Record<string, string | number>

/**
 * TextExtracts 는 **요청당 20건**까지만 extract 를 채운다.
 * gcmlimit 을 그보다 크게 잡으면 나머지는 extract 없이 와서 버려지고, API 는
 * "같은 묶음의 남은 extract 를 받아라"(`excontinue`)만 돌려준다 — 카테고리는 1보도 안 나간다.
 * 그래서 카테고리 배치를 20 으로 맞춰 **왕복 1회 = 카테고리 20편 전진**이 되게 한다.
 */
const EXTRACT_CAP = 20

/**
 * categorymembers 질의 URL 1페이지분.
 *
 * **순수 함수로 뽑아 둔 이유** — 이 저장소는 2026-08-30 까지 카테고리의 **첫 페이지만** 읽고
 * 있었다(`gcmcontinue` 가 코드 전체에 0회 등장). Featured 6,993편 중 손에 닿는 것은 상위
 * ~100편뿐이었고, 그걸 다 담고 나면 "새 것 0" 이 떠서 **소진된 것처럼 보인다.**
 * 조용한 상한이라 지표로는 안 잡힌다 — 그래서 continuation 이 실제로 URL 에 실리는지를
 * 네트워크 없이 테스트로 고정한다.
 */
export function buildWikipediaFeedUrl(
  category: string,
  limit: number,
  cont: WikipediaCursor | null = null,
): string {
  const url = new URL(API_BASE)
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'categorymembers')
  url.searchParams.set('gcmtitle', category)
  // extract 상한(20)을 넘겨 요청하면 남는 페이지는 extract 없이 와서 버려진다 — 순손실이다.
  url.searchParams.set('gcmlimit', String(Math.min(limit, EXTRACT_CAP)))
  url.searchParams.set('gcmtype', 'page')
  url.searchParams.set('gcmnamespace', '0') // 주 기사(ns=0)만 — 관리 페이지 배제
  // sortkey 순은 앞부분이 문장부호-시작 니치(화석종 '?Oryzomys'·'.hack'·'*SCAPE')로 도배됨 →
  //   timestamp desc(최근 승격 GA) 로 다양한 주제 확보 (학습 부적합 니치 편중 완화).
  url.searchParams.set('gcmsort', 'timestamp')
  url.searchParams.set('gcmdir', 'desc')
  url.searchParams.set('prop', 'extracts|info')
  url.searchParams.set('exintro', '1')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('exchars', '320')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('format', 'json')
  // 토큰 키를 골라 쓰지 않는다 — MediaWiki 가 준 것을 그대로 되돌려주는 것이 규약이다.
  if (cont) for (const [k, v] of Object.entries(cont)) url.searchParams.set(k, String(v))
  return url.toString()
}

/**
 * 카테고리 한 페이지 — 다음 페이지 토큰을 함께 돌려준다.
 * `cont` 가 null 이면 그 카테고리는 **정말로** 끝난 것이다(첫 페이지만 본 것과 구분된다).
 */
export async function listWikipediaFeedPage(
  category: string,
  feedId: string = 'good',
  limit: number = 30,
  cont: WikipediaCursor | null = null,
): Promise<{ items: WikipediaListItem[]; cont: WikipediaCursor | null }> {
  const res = await fetchWithTimeout(buildWikipediaFeedUrl(category, limit, cont), {
    accept: 'application/json',
  })
  if (!res.ok) throw new Error(`Wikipedia API fetch failed: ${res.status}`)
  const data = (await res.json()) as MediaWikiQueryResponse
  const pages = Object.values(data.query?.pages ?? {})
  const next = data.continue ?? null
  return {
    items: shapeWikipediaPages(pages, feedId, limit),
    // `continue` 가 통째로 없을 때만 소진이다. 키 하나를 보고 판단하지 않는다.
    cont: next && Object.keys(next).length > 0 ? next : null,
  }
}

/** 기존 호출부(관리자 화면·수집 스크립트)를 위한 첫 페이지 전용 경로 — 시그니처 유지. */
export async function listWikipediaFeed(
  category: string,
  feedId: string = 'good',
  limit: number = 30,
): Promise<WikipediaListItem[]> {
  const { items } = await listWikipediaFeedPage(category, feedId, limit, null)
  return items
}

function shapeWikipediaPages(
  pages: MediaWikiPage[],
  feedId: string,
  limit: number,
): WikipediaListItem[] {

  const raw: WikipediaListItem[] = pages
    // extract 충분 + 제목이 영문자로 시작(문장부호-시작 니치 '?Oryzomys'·'.hack'·'*SCAPE' 배제).
    .filter((p) => (p.extract ?? '').trim().length >= 60 && /^[A-Za-z]/.test((p.title ?? '').trim()))
    .slice(0, limit)
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
