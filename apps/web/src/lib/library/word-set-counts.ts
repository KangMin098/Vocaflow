// apps/web/src/lib/library/word-set-counts.ts
//
// 도서별 발행 챕터 단어장 **개수** — 도서 카탈로그의 "단어장 N" 배지 단일 출처.
//
// 왜 별도 모듈인가: 카탈로그 페이지가 개수를 세려고 세트 행을 **전부 받아 오고** 있었고,
//   PostgREST 는 한 응답에 1,000행까지만 준다(`db-max-rows`). 발행 도서가 13권일 때는
//   세트가 200여 개라 드러나지 않았지만, 2026-08-30 발행 확대(13→316권) 실측에서
//   300권을 넘기는 순간 응답이 **정확히 1000행에서 잘렸다**. 잘린 뒤에는 대부분의 도서가
//   맵에 없어 배지가 `?? 0` 으로 떨어진다 — 오류 없이 **틀린 숫자를 보여 주는** 실패다.
//
// 그래서 두 가지를 바꾼다:
//   ① `.range()` 로 끝까지 페이지네이션한다(마지막 페이지가 1,000 미만일 때 종료).
//   ② 필요한 것은 book_id 하나뿐이므로 `curation_query` jsonb 통째가 아니라
//      `book_id:curation_query->>book_id` 로 좁혀 받는다(페이로드 ~10배 감소).
//
// 오류는 삼키지 않고 던진다 — 호출부가 "개수를 못 셌다" 와 "0개다" 를 구별할 수 있어야 한다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect } from '@/lib/supabase/paged-select'

/**
 * 발행된 도서 챕터 단어장을 도서별로 센다.
 * @returns book_id → 발행 세트 개수
 * @throws 조회 실패 시 — 호출부가 0 과 구별할 수 있도록 삼키지 않는다.
 */
export async function fetchPublishedBookWordSetCounts(
  client: SupabaseClient,
): Promise<Map<string, number>> {
  const rows = await pagedSelect<{ book_id: string | null }>(
    (from, to) =>
      client
        .from('shared_word_sets')
        .select('book_id:curation_query->>book_id')
        .eq('is_published', true)
        .eq('category', 'library_book')
        .range(from, to),
    '발행 단어장 개수',
  )

  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.book_id) continue
    counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1)
  }
  return counts
}
