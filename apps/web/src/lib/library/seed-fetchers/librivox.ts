// LibriVox audiobooks API.
// https://librivox.org/api/feed/audiobooks/?format=json&limit=50&offset=0

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

const BASE = 'https://librivox.org/api/feed/audiobooks/'
const PAGE_SIZE = 50

interface LVBook {
  id: number
  title: string
  description: string | null
  language: string
  authors?: Array<{ id: number; first_name: string; last_name: string; dob: string | null; dod: string | null }>
  genres?: Array<{ id: number; name: string }>
  url_librivox?: string
  url_other?: string
  url_text_source?: string
  totaltime?: string
  totaltimesecs?: number
}

interface LVResponse {
  books?: LVBook[]
}

const GENRES: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  { value: 'Fiction', label: 'Fiction' },
  { value: 'Children', label: "Children's" },
  { value: 'Mystery & Detective Fiction', label: 'Mystery' },
  { value: 'Action & Adventure Fiction', label: 'Adventure' },
  { value: 'Romance', label: 'Romance' },
  { value: 'Short Stories', label: 'Short Stories' },
  { value: 'Poetry', label: 'Poetry' },
  { value: 'Non-fiction', label: 'Non-fiction' },
]

function safeYear(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

function stripWikitext(s: string): string {
  // LibriVox description 은 Wikipedia 발췌 wiki markup 섞여 있음
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''([^']+)'''/g, '$1')
    .replace(/''([^']+)''/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export const librivoxFetcher: SourceFetcher = {
  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const offset = params.offset ?? 0
    const limit = Math.min(params.limit ?? PAGE_SIZE, PAGE_SIZE)

    const url = new URL(BASE)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    if (params.genre) url.searchParams.set('genre', params.genre)
    if (params.genreId != null) url.searchParams.set('genre_id', String(params.genreId))
    // v06.34 — Vocaflow 영어 학습 플랫폼 정책: language 강제 English
    url.searchParams.set('language', 'English')
    // 키워드 검색 — LibriVox 는 title 부분 일치 지원
    if (params.search) url.searchParams.set('title', `^${params.search}`)
    if (params.author) url.searchParams.set('author', `^${params.author}`)
    if (params.publishedSince) url.searchParams.set('since', params.publishedSince)

    const res = await fetch(url, { headers: { 'User-Agent': 'Vocaflow-Curator/1.0' } })
    if (!res.ok) throw new Error(`librivox ${res.status}`)
    const data = (await res.json()) as LVResponse
    // v06.34 — API 가 language=English 보내도 가끔 다국어 반환 — 사후 필터
    const books = (data.books ?? []).filter(
      (b) => !b.language || b.language === 'English',
    )

    const rows: SeedRow[] = books.map((b) => {
      const a = b.authors?.[0]
      const author = a ? `${a.first_name} ${a.last_name}`.trim() : null
      const minutes = b.totaltimesecs ? Math.round(b.totaltimesecs / 60) : null
      return {
        source: 'librivox',
        source_id: String(b.id),
        title: b.title,
        author,
        author_birth_year: safeYear(a?.dob),
        author_death_year: safeYear(a?.dod),
        language: b.language ?? 'English',
        genre: b.genres?.[0]?.name ?? null,
        subjects: (b.genres ?? []).map((g) => g.name).slice(0, 10),
        popularity_rank: null,
        cover_url: null,
        source_url: b.url_text_source ?? b.url_librivox ?? null,
        published_year: null,
        word_count: null,
        description: b.description ? stripWikitext(b.description).slice(0, 1500) : null,
        reading_time_minutes: minutes,
        enriched_at: new Date().toISOString(),
      }
    })

    return {
      source: 'librivox',
      total_available: null,
      fetched: rows,
      next_offset: books.length === limit ? offset + limit : null,
    }
  },
  getOptions(): SourceOptions {
    return {
      sorts: [{ value: 'recent', label: '최신순 (게시일)' }],
      genres: GENRES,
      advanced: ['search', 'author', 'publishedSince', 'genreId'],
      maxBatch: PAGE_SIZE,
      hint: 'LibriVox JSON API — title/author 접두 검색 + since(YYYY-MM-DD) 필터',
    }
  },
}
