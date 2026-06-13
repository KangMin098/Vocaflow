// apps/web/src/lib/library/book-detail-variant.ts
//
// PublishedBook → NetflixDetailSheet 'book' variant 매핑 (단일 출처).
// spotlight(LibraryGrid) · 그리드 카드 · rail 이 동일한 상세 sheet 를 띄우도록 매핑을
// 한 곳에 모은다 (이전엔 LibraryGrid.openDetail 에만 존재 → 중복 방지).

import type { DetailVariant } from '@/components/library/shared/NetflixDetailSheet'
import type { PublishedBook } from './published-book'

export interface DetailHandlers {
  /** 이미 해당 book 에 바인딩된 제외 핸들러 (enrolled 일 때만 footer 노출) */
  onUnenroll?: () => void
  unenrollPending?: boolean
}

export function isEnrolledState(book: PublishedBook): boolean {
  return (
    book.enrollment_state === 'enrolled' ||
    book.enrollment_state === 'in_progress' ||
    book.enrollment_state === 'completed'
  )
}

export function toBookDetailVariant(
  book: PublishedBook,
  userVLevel: number,
  handlers: DetailHandlers = {},
): DetailVariant {
  const isEnrolled = isEnrolledState(book)
  return {
    type: 'book',
    id: book.id,
    title: book.title,
    author: book.author,
    cefrBand: book.cefr_band,
    cefrLevel: book.cefr_level,
    bookVLevel: book.book_v_level,
    wordCount: book.word_count,
    chapterCount: book.chapter_count,
    readingMinutes: book.reading_minutes,
    wordSetCount: book.word_set_count,
    coverFrom: book.cover_from,
    coverTo: book.cover_to,
    coverImageUrl: book.cover_image_url,
    lexicalCoverage: book.lexical_coverage,
    userVLevel,
    // enrollment 상태별 동적 CTA (page.tsx 가 미리 계산하여 prop 으로 전달)
    ctaHref: book.cta_href ?? `/library/books/${book.id}`,
    ctaLabel: book.cta_label ?? '미리보기',
    // 학습 제외 — enrolled 도서만 노출 (Footer 가 알아서 분기)
    isEnrolled,
    onUnenroll: isEnrolled ? handlers.onUnenroll : undefined,
    unenrollPending: handlers.unenrollPending,
    // 큐레이션 메타 (library_seed_catalog 에서 join)
    synopsisKo: book.synopsis_ko,
    learningValue: book.learning_value,
    themes: book.themes,
    estBasis: book.est_basis,
    estCefr: book.est_cefr,
    ageBand: book.age_band,
    genreNorm: book.genre_norm,
    descriptionEn: book.description_en,
  }
}
