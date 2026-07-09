// 공통 인터페이스 — 4 소스 fetcher 공통 시그니처 + 소스별 advanced 확장.
//
// v06.34 — 사용자 명시 요청: "Gutendex 등 각 소스의 advanced 조건 전체 노출"
//   - Gutendex 전체 파라미터 (search · languages · topic · author_year_start/end · copyright · ids · sort · mime_type)
//   - 다른 소스 (Standard Ebooks OPDS · Wikibooks API · LibriVox JSON) 가용 조건 매트릭스화
//
// 기본 4 키 (sort · genre · language · limit · offset) 은 모든 소스 공통.
// 추가 advanced 키들은 옵셔널 — fetcher 가 지원할 때만 사용.

export type SeedSource =
  | 'gutenberg'
  | 'standard_ebooks'
  | 'wikibooks'
  | 'librivox'
  | 'simple_wikipedia'
  | 'lit2go'
  | 'storyweaver'
  | 'pressbooks'

export interface FetchBatchParams {
  // ── 공통 ─────────────────────────────────
  sort?: string              // 'popular' | 'recent' | 'alpha' | 'ascending' | 'descending' | ...
  genre?: string | null      // 소스별 카테고리 키 (소스가 알아서 매핑)
  language?: string          // ISO 639 단일 (default 'en')
  offset?: number            // 페이지 오프셋
  limit?: number             // 1~소스 max

  // ── Advanced (소스별 — 미사용 키는 fetcher 가 무시) ──

  /** Gutendex / Standard Ebooks / LibriVox — 키워드 검색 (제목·저자 결합) */
  search?: string | null

  /** Gutendex — 다국어 multi (ISO 639-1, comma) — language 단일 보다 우선 */
  languages?: string[]

  /** Gutendex — 저자 출생/사망 연도 범위 */
  authorYearStart?: number | null
  authorYearEnd?: number | null

  /** Gutendex — 저작권: true=PD제외 / false=PD만 / null=무관 */
  copyright?: boolean | null

  /** Gutendex — 특정 ID 일괄 (다른 필터 무시) */
  ids?: number[]

  /** Gutendex — MIME 필터 (예: 'text/plain' for plain-text 만) */
  mimeType?: string | null

  /** Standard Ebooks — 정확한 subject slug 지정 (genre 와 별개) */
  subjectSlug?: string | null

  /** Wikibooks — Featured 만 (Wikibooks_featured_books) */
  featuredOnly?: boolean

  /** LibriVox — genre_id (genre 라벨 대신 정확한 ID 지정 시) */
  genreId?: number | null

  /** LibriVox — 게시일 since (YYYY-MM-DD) */
  publishedSince?: string | null

  /** LibriVox — author 직접 지정 */
  author?: string | null

  /** Lit2Go — US Flesch-Kincaid 학년 필터 (예: '6-8' / '9-12' / 'all') */
  lit2goGradeBand?: 'k-2' | '3-5' | '6-8' | '9-12' | 'all' | null
  /** Lit2Go — 오디오 보유 항목만 (USF audiobooks) */
  lit2goAudioOnly?: boolean
}

export interface SeedRow {
  source: SeedSource
  source_id: string
  title: string
  author: string | null
  author_birth_year: number | null
  author_death_year: number | null
  language: string
  genre: string | null
  subjects: string[]
  popularity_rank: number | null
  cover_url: string | null
  source_url: string | null
  published_year: number | null
  word_count: number | null
  /** D + C 에서 채워지는 enriched 필드 */
  description?: string | null
  reading_time_minutes?: number | null
  enriched_at?: string | null
  /** 소스가 신뢰 가능한 난이도 신호를 fetch 시점에 제공할 때만 (StoryWeaver 레벨 등).
   *  대부분 소스는 미설정 → 큐레이션/analyze 단계에서 채움 (coverage 가 SSoT). */
  est_v_level?: number | null
}

export interface FetchBatchResult {
  source: SeedSource
  total_available: number | null
  fetched: SeedRow[]
  next_offset: number | null
}

// ── UI 가 소스별 가용 advanced field 동적 표시용 ───────────────
export type AdvancedFieldKey =
  | 'search'
  | 'languages'
  | 'authorYearRange'
  | 'copyright'
  | 'ids'
  | 'mimeType'
  | 'subjectSlug'
  | 'featuredOnly'
  | 'genreId'
  | 'publishedSince'
  | 'author'
  | 'lit2goGradeBand'
  | 'lit2goAudioOnly'

export interface SourceOptions {
  sorts: Array<{ value: string; label: string }>
  genres: Array<{ value: string; label: string }>
  /** 이 소스가 받는 advanced 필드 키들 */
  advanced: AdvancedFieldKey[]
  /** 자주 쓰는 언어 코드 (UI multi-select 표시) — 빈 배열이면 단일 language 만 */
  popularLanguages?: Array<{ value: string; label: string }>
  maxBatch: number
  /** 소스 한 줄 소개 — UI hint */
  hint?: string
}

export interface SourceFetcher {
  fetchBatch(params: FetchBatchParams): Promise<FetchBatchResult>
  getOptions(): SourceOptions
}
