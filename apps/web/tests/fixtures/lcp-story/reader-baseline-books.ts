// apps/web/tests/fixtures/lcp-story/reader-baseline-books.ts
//
// T-0176 LCP Story S5 — 기존 Library(Books 면) 기준선 캡처용 **합성** 도서 목록(SYNTHETIC — 실제 도서 · 실제 진도 아님).
// apps/web/scripts/build-lcp-story-reader-harness.mts --baseline 이 이 값을 BooksExplorer 에 그대로 넘긴다.
// 모양은 app/(main)/library/books/page.tsx 가 BooksExplorer 에 넘기는 PublishedBook(가공 뒤) 그대로다. 표지 이미지 URL 은 두지 않는다(외부 요청 0).

import type { PublishedBook } from '../../../src/lib/library/published-book'

export const SYNTHETIC_BOOKS_LABEL = 'SYNTHETIC — lcp-story S5 reader harness baseline (not real books)'

const TITLES: [string, string, string, number, number][] = [
  // [title, author, cefr, v-level, chapters]
  ['Harbor Lights (synthetic)', 'Synthetic Author A', 'A2', 3, 6],
  ['The Paper Kite (synthetic)', 'Synthetic Author B', 'A2', 4, 8],
  ['North Road Diaries (synthetic)', 'Synthetic Author C', 'B1', 5, 10],
  ['Salt and Stone (synthetic)', 'Synthetic Author D', 'B1', 6, 12],
  ['The Clockmaker’s Window (synthetic)', 'Synthetic Author E', 'B2', 7, 9],
  ['Rain Over Fenwick (synthetic)', 'Synthetic Author F', 'B2', 8, 14],
  ['A Garden in Winter (synthetic)', 'Synthetic Author G', 'A1', 2, 5],
  ['Letters From the Ridge (synthetic)', 'Synthetic Author H', 'B1', 5, 7],
]

export const BASELINE_BOOKS: PublishedBook[] = TITLES.map(([title, author, cefr, v, chapters], i) => ({
  id: `00000000-0000-4000-8000-${(0xb00 + i).toString(16).padStart(12, '0')}`,
  title,
  author,
  cefr_level: cefr,
  cefr_band: cefr,
  book_v_level: v,
  word_count: 4000 + i * 1750,
  chapter_count: chapters,
  reading_minutes: 20 + i * 7,
  cover_from: null,
  cover_to: null,
  cover_image_url: null,
  is_picture_book: false,
  lexical_coverage: null,
  word_set_count: i % 3,
  has_audio: false,
  popularity_rank: i + 1,
  synopsis_ko: '합성 기준선용 줄거리 — 실제 도서가 아니다.',
  learning_value: null,
  themes: null,
  est_basis: null,
  est_cefr: cefr,
  age_band: null,
  genre_norm: null,
  chapter_v_hist: null,
  description_en: null,
  published_at: `2026-10-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`,
  enrollment_state: 'not_enrolled',
  progress_pct: 0,
  cta_href: `/library/books/00000000-0000-4000-8000-${(0xb00 + i).toString(16).padStart(12, '0')}`,
  cta_label: '미리보기',
}))
