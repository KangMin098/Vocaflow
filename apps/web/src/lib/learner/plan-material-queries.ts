// apps/web/src/lib/learner/plan-material-queries.ts
//
// 학습자 "계획에 추가할 자료" 선택기의 목록 조회 — `fetchAvailableMaterials` 가 쓴다.
//
// 왜 파일을 나눴나: 이 세 조회는 **상한(limit)과 분리 여부가 곧 정확성**인데,
//   서버 액션 안에 인라인으로 있으면 회귀를 테스트로 못 잡는다. 2026-08-30 에 실제로 두 번 깨졌다:
//
//   ① 도서 `.limit(300)` — 발행 도서가 316권이 되자 제목순으로 **16권이 조용히 잘렸다.**
//   ② 단어장 `.limit(600)` 을 카테고리 구분 없이 걸어 두어, 발행 확대로 챕터 세트가
//      1,129 → 10,923 이 되자 **큐레이션 70개 중 화면에 남은 것이 1개**였다(실측).
//      수능·고등·중등·어원·비즈니스 세트가 사실상 사라진 상태였고, 오류는 없었다.
//
// 그래서 규칙을 여기 못 박는다:
//   · 발행 도서와 큐레이션 단어장은 **상한을 두지 않는다** (각각 수백·수십 규모).
//   · 자동 생성되는 도서 챕터 단어장만 따로, **학습자가 등록한 도서로 한정해서** 받는다
//     (카탈로그 크기가 아니라 학습자 수강 범위로 한계가 정해지므로 더 늘어나지 않는다).

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect, pagedSelectIn } from '@/lib/supabase/paged-select'

/** 자동 생성 세트 — 큐레이션 목록에서 분리해야 하는 카테고리. */
export const AUTO_SET_CATEGORIES = ['library_book', 'library_article'] as const

const BOOK_COLS = 'id, title, author, book_v_level, cover_image_url, chapter_count'
const SET_COLS = 'id, title, slug, category, word_count, cover_emoji, cefr_level, curation_query'


/**
 * 계획에 넣을 수 있는 발행 도서 전량.
 * 게이트는 `/library/books` 브라우즈와 같다 — 어긋나면 목록엔 뜨는데
 * `enroll_library_book` 이 예외를 던진다(v06.215 에서 실제로 났던 버그).
 */
export function fetchPlanBooks<T>(client: SupabaseClient): Promise<T[]> {
  return pagedSelect<T>((from, to) =>
    client
      .from('library_books')
      .select(BOOK_COLS)
      .eq('status', 'published')
      .eq('copyright_safe_in_kr', true)
      .not('published_at', 'is', null)
      .order('title')
      .range(from, to),
  '발행 도서',
  )
}

/**
 * 큐레이션 단어장 전량 — 자동 생성 세트(도서 챕터·글)는 제외한다.
 * 한 조회로 합치고 상한을 걸면 챕터 세트가 이쪽을 밀어낸다(파일 상단 ② 참조).
 */
export function fetchPlanCuratedSets<T>(client: SupabaseClient): Promise<T[]> {
  const notIn = `("${AUTO_SET_CATEGORIES.join('","')}")`
  return pagedSelect<T>((from, to) =>
    client
      .from('shared_word_sets')
      .select(SET_COLS)
      .eq('is_published', true)
      .not('category', 'in', notIn)
      .order('title')
      .range(from, to),
  '큐레이션 단어장',
  )
}

/**
 * 도서 챕터 단어장 — **학습자가 등록한 도서에 한정.**
 * 등록하지 않은 책의 챕터는 계획에 넣어도 본문이 없어 쓸 수 없고,
 * 책을 등록하면 `_enroll_book_subscribe_word_sets` 가 그 책의 세트를 구독시키므로
 * 여기서 다시 뜬다 — 도달 경로가 사라지지 않는다.
 */
export async function fetchPlanChapterSets<T>(
  client: SupabaseClient,
  enrolledBookIds: string[],
): Promise<T[]> {
  return pagedSelectIn<T>(
    enrolledBookIds,
    (chunk, from, to) =>
      client
        .from('shared_word_sets')
        .select(SET_COLS)
        .eq('is_published', true)
        .eq('category', 'library_book')
        .in('curation_query->>book_id', chunk)
        .order('title')
        .range(from, to),
    '챕터 단어장',
  )
}
