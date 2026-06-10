// apps/web/src/lib/library/published-book.ts
//
// 라이브러리 도서 노출용 도메인 타입 (단일 출처).
// LibraryGrid / BooksExplorer / BookGridCard / book-detail-variant 가 공유 —
// LibraryGrid 에 두면 컴포넌트 ↔ 헬퍼 간 순환 import 가 생기므로 lib 으로 분리.

export type EnrollmentState = 'not_enrolled' | 'enrolled' | 'in_progress' | 'completed'

export interface PublishedBook {
  id: string
  title: string
  author: string | null
  cefr_level: string | null
  cefr_band: string | null
  book_v_level: number | null
  word_count: number | null
  chapter_count: number | null
  reading_minutes: number | null
  word_set_count?: number
  cover_from?: string | null
  cover_to?: string | null
  /** 원천 표지 이미지 URL (Gutenberg/SE) — 상세 sheet hero 에 실 표지 */
  cover_image_url?: string | null
  // i+1 적합도 — V레벨별 기지어 커버리지 (compute_book_coverage)
  lexical_coverage?: Record<string, number> | null
  // 큐레이션 메타 (library_seed_catalog join)
  synopsis_ko?: string | null
  learning_value?: string | null
  themes?: string[] | null
  est_basis?: string | null
  est_cefr?: string | null
  age_band?: string | null
  genre_norm?: string | null
  description_en?: string | null
  // 탐색/추천/정렬 시그널
  /** library_seed_catalog.popularity_rank (작을수록 인기) */
  popularity_rank?: number | null
  /** librivox_audio 존재 여부 (원어민 음성) */
  has_audio?: boolean
  /** 정렬 '신규순' 용 */
  published_at?: string | null
  // 사용자별 enrollment 상태 + 진행도 + 동적 CTA
  enrollment_state?: EnrollmentState
  progress_pct?: number
  cta_href?: string
  cta_label?: string
}
