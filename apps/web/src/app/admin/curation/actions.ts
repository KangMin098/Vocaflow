// apps/web/src/app/admin/curation/actions.ts
// Server Actions — curated books 삭제 등.
//
// v06.34 — MyLibraryTab BookRow 의 실패 도서 삭제 버튼 wire-up.

'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { deleteBook } from '@/lib/library/admin-queries'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * 실패 상태 도서 영구 삭제.
 * RPC admin_delete_book 가 status 검증 (failed/fetch_failed/preview_failed/ingest_failed/enrich_failed/ready/archived 만 허용).
 */
export async function deleteFailedBookAction(
  bookId: string,
): Promise<ActionResult<{ word_sets_deleted: number; texts_unlinked: number; seed_unlocked: number }>> {
  try {
    await requireAdmin('/admin/curation')
    const client = (await createClient()) as unknown as SupabaseClient
    const result = await deleteBook(client, bookId)
    revalidatePath('/admin/curation')
    return {
      ok: true,
      data: {
        word_sets_deleted: result.word_sets_deleted,
        texts_unlinked: result.texts_unlinked,
        seed_unlocked: result.seed_unlocked,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '삭제 실패 (알 수 없는 오류)',
    }
  }
}
