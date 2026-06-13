// apps/web/src/app/(main)/text/actions.ts
// v06.34 — 내 스크립트 제외 (삭제) server actions
//
// 세 가지 케이스:
//   (1) 사용자 직접 입력 단일 텍스트 — texts row 단일 DELETE
//   (2) 라이브러리 도서 chapter 집계 카드 — unenroll_library_book RPC (모든 chapter 일괄)
//   (3) 사용자 직접 입력 책 그룹 카드 — user_book_group_id 일괄 DELETE

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DeleteResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'unauthenticated' | 'not_found' | 'error'; message?: string }

/** 직접 입력/업로드 텍스트 단일 삭제 (그룹 소속이면 거부 — 책 단위 액션 사용). */
export async function deleteUserTextAction(textId: string): Promise<DeleteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // library_book_id 또는 user_book_group_id 있는 chapter row 는 이 액션 거부
  const { data: row } = await supabase
    .from('texts')
    .select('id, library_book_id, user_book_group_id')
    .eq('id', textId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!row) return { ok: false, reason: 'not_found' }
  const typedRow = row as {
    library_book_id: string | null
    user_book_group_id: string | null
  }
  if (typedRow.library_book_id) {
    return {
      ok: false,
      reason: 'error',
      message: '라이브러리 도서는 도서 단위로 제외해 주세요.',
    }
  }
  if (typedRow.user_book_group_id) {
    return {
      ok: false,
      reason: 'error',
      message: '책 그룹의 챕터는 책 단위로 제외해 주세요.',
    }
  }

  const { error } = await supabase
    .from('texts')
    .delete()
    .eq('id', textId)
    .eq('user_id', user.id)
  if (error) return { ok: false, reason: 'error', message: error.message }

  revalidatePath('/text')
  return { ok: true, deletedCount: 1 }
}

/**
 * v06.34 — 사용자 직접 입력 책 그룹 일괄 DELETE.
 * 같은 user_book_group_id 의 모든 texts row 를 삭제 (사용자 격리 + count 검증).
 */
export async function deleteUserBookGroupAction(
  groupId: string,
): Promise<DeleteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // 사전 카운트 — RLS 가 user_id 격리 보장이지만, 보고용으로 카운트.
  const { data: rows } = await supabase
    .from('texts')
    .select('id', { count: 'exact', head: false })
    .eq('user_id', user.id)
    .eq('user_book_group_id', groupId)
  const targetCount = (rows ?? []).length
  if (targetCount === 0) return { ok: false, reason: 'not_found' }

  const { error } = await supabase
    .from('texts')
    .delete()
    .eq('user_id', user.id)
    .eq('user_book_group_id', groupId)
  if (error) return { ok: false, reason: 'error', message: error.message }

  revalidatePath('/text')
  revalidatePath('/wordvault')
  return { ok: true, deletedCount: targetCount }
}

/** 라이브러리 도서 unenroll (chapter texts + chapter sets + shared_set vocab 일괄). */
export async function unenrollBookAction(bookId: string): Promise<DeleteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const { data, error } = await supabase.rpc('unenroll_library_book', {
    p_book_id: bookId,
  })
  if (error) return { ok: false, reason: 'error', message: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as {
    texts_deleted: number
  } | null

  revalidatePath('/text')
  revalidatePath('/library/books')
  revalidatePath('/wordvault')
  return { ok: true, deletedCount: row?.texts_deleted ?? 0 }
}
