// packages/library-pipeline/src/types.ts
// LCP v2.0 — Shared types

export type LibrarySource =
  | 'gutenberg'
  | 'standard_ebooks'
  | 'wikisource'
  | 'wikibooks'
  | 'librivox'
  | 'openstax'
  | 'simple_wikipedia'
  | 'lit2go'
  | 'storyweaver'
  | 'manual'

/** 그림책 페이지(=문단)별 삽화 (링크 방식). idx = 본문 문단 인덱스. */
export interface BookIllustration {
  idx: number
  url: string
  alt?: string
}

export type LibraryBookStatus =
  | 'queued'
  | 'ingesting'
  | 'normalizing'
  | 'segmenting'
  | 'analyzing'
  | 'curating'
  | 'ready'
  | 'published'
  | 'archived'
  | 'failed'

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Stage S2 INGEST 결과 */
export interface RawBook {
  source: LibrarySource
  source_id: string
  source_url: string
  title: string
  author?: string
  author_birth_year?: number
  author_death_year?: number
  language: string
  license: string
  raw_content: string //   boilerplate 포함
  fetched_at: Date
  /** 그림책 페이지별 삽화 (StoryWeaver 등). 본문 문단과 idx 정합. */
  illustrations?: BookIllustration[]
  /** 원천 표지 이미지 URL (소스가 직접 제공 시 — resolveCoverImageUrl 우회). */
  cover_image_url?: string
  /** 단일 스트림 낭독 오디오 URL (StoryWeaver readalong mp3 등). */
  audio_url?: string
  /** 짧은 줄거리/시놉시스 (소스 제공 시 — library_books.description). */
  description?: string
}

/** Stage S3 NORMALIZE 결과 */
export interface NormalizedBook {
  raw: RawBook
  body: string //          boilerplate 제거된 본문
  body_hash: string //     SHA-256
}

/** Stage S4 SEGMENT 결과의 단일 chapter */
export interface ChapterSegment {
  chapter_idx: number
  chapter_title?: string
  /** 계층 그룹 라벨 (Volume/Book 또는 sub-book) — 평면 chapter_idx 유지, 리더 그룹핑용. 평면책은 undefined */
  group_label?: string
  /** 원본 소스의 해당 챕터 deep-link URL (SE: TOC href 매핑). 매핑 실패·타 소스는 undefined → 렌더가 도서 TOC 로 fallback */
  source_href?: string
  content: string
  word_count: number
  paragraph_offsets: number[]
  sentence_offsets: number[]
}

/** Stage S5 ANALYZE 결과의 단일 단어 */
export interface ChapterWord {
  word: string
  chapter_idx: number
  frequency_in_chapter: number
  frequency_in_book: number
  first_sentence: string
  base_learning_value: number
}

/** Stage S5 ANALYZE 전체 결과 */
export interface AnalyzedBook {
  book_id: string
  cefr_level: CefrLevel
  cefr_confidence: number
  word_count: number
  chapter_count: number
  reading_minutes: number
  words: ChapterWord[]
  llm_cost_usd: number
}

/** Stage S6 CURATE 자동 판정 결과 */
export type CurationDecision =
  | { type: 'auto_publish' }
  | { type: 'admin_review'; reason: string }
  | { type: 'reject'; reason: string }

/** 책 분할 알고리즘 옵션 */
export interface SegmentOptions {
  /** chapter 감지 실패 시 fallback 단어 수 (기본 5000) */
  fallbackChunkWords?: number
  /** chapter 최소 단어 수 (이보다 짧으면 다음과 병합 가능) */
  minChapterWords?: number
}
