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

export interface UnenrollResult {
  textsDeleted: number
  subsDeleted: number
  vocabsDeleted: number
}

/**
 * v06.34 — 도서 학습 제외 (enroll 역동작).
 * texts row + chapter sets 구독 + origin='shared_set' vocab 일괄 삭제.
 * 사용자 직접 수정 vocab (origin != 'shared_set') 은 보존.
 * 멱등: 이미 unenrolled 면 모든 count 0 반환.
 */
export async function unenrollBook(
  client: SupabaseClient,
  bookId: string,
): Promise<UnenrollResult> {
  const { data, error } = await client.rpc('unenroll_library_book', {
    p_book_id: bookId,
  })
  if (error) {
    throw new Error(`unenrollBook failed: ${error.message}`)
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    texts_deleted: number
    subs_deleted: number
    vocabs_deleted: number
  } | null
  return {
    textsDeleted: row?.texts_deleted ?? 0,
    subsDeleted: row?.subs_deleted ?? 0,
    vocabsDeleted: row?.vocabs_deleted ?? 0,
  }
}
