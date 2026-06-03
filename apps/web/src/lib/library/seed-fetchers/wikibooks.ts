// Wikibooks — MediaWiki API.
// Category 기반 (예: "Wikibooks_Featured_books"). cmlimit max 500.

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const API = 'https://en.wikibooks.org/w/api.php'
const PAGE_SIZE = 50

// v06.34 fix — 실제 Wikibooks 카테고리 이름 (en.wikibooks.org allcategories 실측).
// 라벨은 다른 소스와 형식 통일 (멤버 수는 hint 영역으로 분리).
// 카테고리당 실제 멤버는 보통 3~42권 — 50 배치 시 한 번에 다 가져옴.
const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'Featured books', label: 'Featured Books (정선)' },
  { value: 'Subject:Science', label: 'Science' },
  { value: 'Subject:Humanities', label: 'Humanities' },
  { value: 'Subject:Mathematics', label: 'Mathematics' },
  { value: 'Subject:Engineering', label: 'Engineering' },
  { value: 'Subject:Social sciences', label: 'Social Sciences' },
  { value: 'Subject:Recreational activities', label: 'Recreation' },
  { value: 'Subject:Languages', label: 'Languages' },
  { value: 'Subject:Computing', label: 'Computing' },
]

interface CatMember {
  pageid: number
  title: string
  ns: number
}

interface CatResponse {
  query?: { categorymembers?: CatMember[] }
  continue?: { cmcontinue?: string }
}

export const wikibooksFetcher: SourceFetcher = {
  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    // Featured only → 'Featured books' category 강제 (Wikibooks 정확한 이름)
    const category = params.featuredOnly
      ? 'Featured books'
      : params.genre || 'Featured books'
    const offset = params.offset ?? 0
    const limit = Math.min(params.limit ?? PAGE_SIZE, 500)

    // 검색 모드: search 입력 시 categorymembers 대신 search list 사용
    const useSearch = !!params.search
    const url = new URL(API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    if (useSearch) {
      url.searchParams.set('list', 'search')
      url.searchParams.set('srsearch', params.search!)
      url.searchParams.set('srnamespace', '0')
      url.searchParams.set('srlimit', String(limit))
      url.searchParams.set('sroffset', String(offset))
    } else {
      url.searchParams.set('list', 'categorymembers')
      url.searchParams.set('cmtitle', `Category:${category}`)
      url.searchParams.set('cmlimit', String(Math.min(offset + limit, 500)))
      url.searchParams.set('cmnamespace', '0')
      // sort: 'recent' → timestamp DESC / 'alpha' → sortkey ASC (default)
      url.searchParams.set('cmsort', params.sort === 'recent' ? 'timestamp' : 'sortkey')
      if (params.sort === 'recent') url.searchParams.set('cmdir', 'desc')
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vocaflow-Curator/1.0 (https://vocaflow.app)' },
    })
    if (!res.ok) {
      // 429 rate limit 명시
      if (res.status === 429) {
        throw new Error(
          `Wikibooks rate limit (HTTP 429) — 잠시 후 재시도하세요 (보통 30초~1분)`,
        )
      }
      throw new Error(`wikibooks HTTP ${res.status}`)
    }
    const data = (await res.json()) as CatResponse & {
      query?: {
        search?: Array<{ pageid: number; title: string; size: number; wordcount: number }>
        searchinfo?: { totalhits: number }
      }
    }

    let rows: SeedRow[]
    let totalAvailable: number | null = null
    let hasMore = false

    // v06.34 fix — source_id 를 **title** 로 저장 (preview API 가 title 받음)
    // pageid 는 fallback URL 에 보조로만 사용. title 이 stable URL identifier.
    const toTitleSlug = (t: string) => t.replace(/\s+/g, '_')

    if (useSearch) {
      const hits = data.query?.search ?? []
      totalAvailable = data.query?.searchinfo?.totalhits ?? null
      hasMore = hits.length === limit
      rows = hits.map((h) => ({
        source: 'wikibooks',
        source_id: toTitleSlug(h.title),
        title: h.title,
        author: 'Wikibooks contributors',
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: null,
        subjects: [],
        popularity_rank: null,
        cover_url: null,
        source_url: `https://en.wikibooks.org/wiki/${encodeURIComponent(toTitleSlug(h.title))}`,
        published_year: null,
        word_count: h.wordcount,
      }))
    } else {
      const all = data.query?.categorymembers ?? []
      const slice = all.slice(offset, offset + limit)
      hasMore = offset + limit < all.length
      totalAvailable = all.length >= 500 ? null : all.length
      rows = slice.map((m) => ({
        source: 'wikibooks',
        source_id: toTitleSlug(m.title),
        title: m.title,
        author: 'Wikibooks contributors',
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: category,
        subjects: [category],
        popularity_rank: null,
        cover_url: null,
        source_url: `https://en.wikibooks.org/wiki/${encodeURIComponent(toTitleSlug(m.title))}`,
        published_year: null,
        word_count: null,
      }))
    }

    return {
      source: 'wikibooks',
      total_available: totalAvailable,
      fetched: rows,
      next_offset: hasMore ? offset + limit : null,
    }
  },
  getOptions(): SourceOptions {
    return {
      sorts: [
        { value: 'alpha', label: '카테고리 알파벳' },
        { value: 'recent', label: '최근 수정순' },
      ],
      genres: CATEGORIES,
      advanced: ['search', 'featuredOnly'],
      maxBatch: PAGE_SIZE,
      hint: 'Wikibooks MediaWiki — 카테고리별 평균 3~42권 (배치보다 적게 반환될 수 있음)',
    }
  },
}
