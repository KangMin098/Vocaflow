// apps/web/src/lib/library/enroll.ts
// LCP v2.0 Phase 8 — 라이브러리 책 enroll 클라이언트 헬퍼

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 라이브러리 책을 사용자 학습 texts로 등록.
 * 멱등: 이미 enroll했으면 기존 text id 배열 그대로 반환.
 *
 * @returns chapter_idx 오름차순으로 정렬된 texts.id[] (첫 element가 chapter 1)
 */
export async function enrollBook(
  client: SupabaseClient,
  bookId: string,
): Promise<string[]> {
  const { data, error } = await client.rpc('enroll_library_book', {
    p_book_id: bookId,
  })

  if (error) {
    throw new Error(`enrollBook failed: ${error.message}`)
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('enrollBook: no texts returned')
  }

  return data as string[]
}
