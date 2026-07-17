// apps/web/src/lib/library/seed-fetchers/pressbooks.ts
//
// Pressbooks (opentextbc.ca 등) OA 교재 seed fetcher.
//
// Pressbooks 는 통합 카탈로그 API 가 없음(네트워크마다 상이) → **정적 큐레이션 리스트**.
//   Factbook 국가 리스트와 동형 — 검증된(200) 슬러그만 채택, 큐레이터가 확장.
//   실 제목·저자·라이선스는 ingest 시 citation_* 메타에서 재취득(여기 값은 표시용).
//
// source_id 형식: "<host>/<book-slug>" (ingester ALLOWED_HOST 정합).
//   예: "opentextbc.ca/introductiontosociology2ndedition"

import type {
  FetchBatchParams,
  FetchBatchResult,
  SeedRow,
  SourceFetcher,
  SourceOptions,
} from './types'

interface PbBook {
  host: string
  slug: string
  title: string
  author: string
  subject: string
  estV: number
}

// 검증된 OA 교재 (슬러그 200 실측 · CC-BY). 큐레이터가 검증 슬러그 추가 가능.
const PRESSBOOKS_CATALOG: PbBook[] = [
  {
    host: 'opentextbc.ca',
    slug: 'introductiontosociology2ndedition',
    title: 'Introduction to Sociology – 2nd Canadian Edition',
    author: 'William Little',
    subject: 'Sociology',
    estV: 8,
  },
  {
    host: 'opentextbc.ca',
    slug: 'introductiontopsychology',
    title: 'Introduction to Psychology – 1st Canadian Edition',
    author: 'Jennifer Walinga, Charles Stangor',
    subject: 'Psychology',
    estV: 8,
  },
  {
    host: 'opentextbc.ca',
    slug: 'writingforsuccess',
    title: 'Writing for Success',
    author: 'BCcampus (adapted)',
    subject: 'Writing',
    estV: 7,
  },
  {
    host: 'opentextbc.ca',
    slug: 'introductorychemistry',
    title: 'Introductory Chemistry',
    author: 'David W. Ball',
    subject: 'Chemistry',
    estV: 8,
  },
]

const SUBJECTS = ['Sociology', 'Psychology', 'Writing', 'Chemistry']

export const pressbooksFetcher: SourceFetcher = {
  getOptions(): SourceOptions {
    return {
      sorts: [{ value: 'alpha', label: '제목순' }],
      genres: [
        { value: '', label: '전체 주제' },
        ...SUBJECTS.map((s) => ({ value: s, label: s })),
      ],
      advanced: ['search'],
      maxBatch: 20,
      hint:
        'Pressbooks(opentextbc.ca) OA 교재 — CC-BY 다수 · 서버렌더 HTML 챕터. ' +
        '통합 카탈로그 API 부재 → 정적 큐레이션 리스트(검증 슬러그 · 확장 가능). 실 메타는 ingest 시 재취득.',
    }
  },

  async fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult> {
    const { genre, search, limit = 20, offset = 0 } = params

    let books = PRESSBOOKS_CATALOG
    if (genre && genre.length > 0) books = books.filter((b) => b.subject === genre)
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase()
      books = books.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      )
    }

    const slice = books.slice(offset, offset + limit)
    const rows: SeedRow[] = slice.map((b) => ({
      source: 'pressbooks',
      source_id: `${b.host}/${b.slug}`,
      title: b.title,
      author: b.author,
      author_birth_year: null,
      author_death_year: null,
      language: 'en',
      genre: b.subject,
      subjects: [b.subject],
      popularity_rank: null,
      cover_url: null,
      source_url: `https://${b.host}/${b.slug}/`,
      published_year: null,
      word_count: null,
      description: `${b.subject} OA 교재 (Pressbooks · CC-BY · 실 메타는 ingest 시 재취득)`,
      reading_time_minutes: null,
      enriched_at: null,
      est_v_level: b.estV,
    }))

    return {
      source: 'pressbooks',
      total_available: books.length,
      fetched: rows,
      next_offset: offset + slice.length < books.length ? offset + slice.length : null,
    }
  },
}
