// apps/web/src/lib/library/seed-fetchers/storyweaver.ts
//
// StoryWeaver (Pratham Books) seed fetcher — CC BY 4.0 다국어 그림책.
//   books-search JSON API (서버 fetch, UA 필수). 레벨 1-4 필터 + 키워드 검색.
//   목록엔 저자 미포함 → ingest(read API) 에서 채움. 레벨은 genre/subjects 로 보존.
//   est_v_level 은 분석(coverage) 이 SSoT — fetch 단계 미설정 (lit2go 와 동일 정책).

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const API = 'https://storyweaver.org.in/api/v1/books-search'
const UA = 'Vocaflow-LCP-StoryWeaver/1.0 (admin curation)'

interface SWBook {
  id: number
  title: string
  language: string
  level: string | null
  slug: string
  coverImage?: { sizes?: Array<{ url: string; width: number; height: number }> } | null
}

/** coverImage.sizes 중 리스트 썸네일에 맞는 ~320px 폭 선택 (없으면 첫/마지막). */
function pickCover(b: SWBook): string | null {
  const sizes = b.coverImage?.sizes
  if (!Array.isArray(sizes) || sizes.length === 0) return null
  let best = sizes[0]
  for (const s of sizes) {
    if (
      typeof s?.url === 'string' &&
      Math.abs((s.width ?? 0) - 320) < Math.abs((best?.width ?? 99999) - 320)
    ) {
      best = s
    }
  }
  const url = best?.url
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
}

export const storyweaverFetcher: SourceFetcher = {
  getOptions(): SourceOptions {
    return {
      sorts: [{ value: 'popular', label: '관련/인기순 (기본)' }],
      genres: [
        { value: '', label: '레벨 전체' },
        { value: '1', label: 'Level 1 (입문 · 한 줄)' },
        { value: '2', label: 'Level 2 (쉬움)' },
        { value: '3', label: 'Level 3 (중급)' },
        { value: '4', label: 'Level 4 (긴 글)' },
      ],
      advanced: ['search'],
      maxBatch: 24,
      hint:
        'StoryWeaver (Pratham Books) — CC BY 4.0 그림책. 페이지별 삽화 + 낭독 오디오. ' +
        '레벨 1-4 = A1-B1 초급 학습자/아동 본체. 저자는 ingest 시 채워짐.',
    }
  },

  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const { genre, limit = 24, offset = 0, search } = params
    const perPage = Math.min(Math.max(limit, 1), 48)
    const page = Math.floor(offset / perPage) + 1

    const qs = new URLSearchParams()
    qs.set('language', 'English')
    qs.set('per_page', String(perPage))
    qs.set('page', String(page))
    if (genre && /^[1-4]$/.test(genre)) qs.append('reading_levels[]', genre)
    if (search && search.trim()) qs.set('query', search.trim())

    const res = await fetch(`${API}?${qs.toString()}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`StoryWeaver books-search failed: ${res.status}`)
    const json = (await res.json()) as {
      ok?: boolean
      metadata?: { hits?: number; totalPages?: number }
      data?: SWBook[]
    }
    const data = Array.isArray(json.data) ? json.data : []

    const fetched: SeedRow[] = data
      .filter((b) => b && b.slug)
      .map((b, i) => ({
        source: 'storyweaver',
        source_id: b.slug || String(b.id),
        title: b.title,
        author: null, // books-search 미포함 — ingest(read API) 에서 채움
        author_birth_year: null,
        author_death_year: null,
        language: 'en',
        genre: b.level ? `Level ${b.level}` : null,
        subjects: ['storyweaver', 'picture-book', ...(b.level ? [`level-${b.level}`] : [])],
        popularity_rank: offset + i + 1, // API 기본 정렬 = 관련/인기 proxy
        cover_url: pickCover(b),
        source_url: `https://storyweaver.org.in/stories/${b.slug || b.id}`,
        published_year: null,
        word_count: null,
        description: null,
        reading_time_minutes: null,
        enriched_at: null,
      }))

    const total = json.metadata?.hits ?? null
    const nextOffset = data.length === perPage ? offset + data.length : null
    return { source: 'storyweaver', total_available: total, fetched, next_offset: nextOffset }
  },
}
