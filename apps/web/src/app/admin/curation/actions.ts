// apps/web/src/app/admin/curation/actions.ts
// Server Actions — curated books 삭제 등.
//
// v06.34 — MyLibraryTab BookRow 의 실패 도서 삭제 버튼 wire-up.

'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import {
  bulkRequeueBooks,
  bulkSetBooksCurating,
  deleteBook,
  enqueueQuizJobs,
  fetchCurationJobs,
  fetchQuizJobs,
  type CurationJobRow,
  type QuizJobRow,
} from '@/lib/library/admin-queries'
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

export interface BulkRollbackToCuratingActionData {
  updatedCount: number
  skippedCount: number
  wordSetsDeleted: number
  blockedByUsers: number
  blockedByPublished: number
}

export interface BulkRollbackToQueuedActionData {
  deletedCount: number
  skippedCount: number
  wordSetsDeleted: number
  seedUnlocked: number
  blockedByUsers: number
  blockedByPublished: number
}

/**
 * 검토대기(ready) → 처리중(curating). draft 챕터 단어장 삭제 + status reclassify.
 * 안전 가드: published 단어장/사용자 진도 있는 도서는 자동 스킵.
 */
export async function bulkSetBooksToInProgressAction(
  bookIds: string[],
): Promise<ActionResult<BulkRollbackToCuratingActionData>> {
  try {
    await requireAdmin('/admin/curation')
    if (bookIds.length === 0) {
      return {
        ok: true,
        data: {
          updatedCount: 0,
          skippedCount: 0,
          wordSetsDeleted: 0,
          blockedByUsers: 0,
          blockedByPublished: 0,
        },
      }
    }
    const client = (await createClient()) as unknown as SupabaseClient
    const result = await bulkSetBooksCurating(client, bookIds)
    revalidatePath('/admin/curation')
    return { ok: true, data: result }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '상태 변경 실패',
    }
  }
}

/**
 * (ready ∪ in_progress ∪ failed) → 소스 get: library_books DELETE → BulkFetchTab 으로 복귀.
 * 안전 가드: published 단어장/사용자 진도 있는 도서는 자동 스킵.
 */
export async function bulkRequeueBooksAction(
  bookIds: string[],
): Promise<ActionResult<BulkRollbackToQueuedActionData>> {
  try {
    await requireAdmin('/admin/curation')
    if (bookIds.length === 0) {
      return {
        ok: true,
        data: {
          deletedCount: 0,
          skippedCount: 0,
          wordSetsDeleted: 0,
          seedUnlocked: 0,
          blockedByUsers: 0,
          blockedByPublished: 0,
        },
      }
    }
    const client = (await createClient()) as unknown as SupabaseClient
    const result = await bulkRequeueBooks(client, bookIds)
    revalidatePath('/admin/curation')
    return { ok: true, data: result }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '소스 복귀 실패',
    }
  }
}

/** 큐 상태 뷰용 — 최근 작업 목록 조회. */
export async function fetchCurationJobsAction(): Promise<ActionResult<CurationJobRow[]>> {
  try {
    await requireAdmin('/admin/curation')
    const client = (await createClient()) as unknown as SupabaseClient
    const jobs = await fetchCurationJobs(client)
    return { ok: true, data: jobs }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '큐 조회 실패',
    }
  }
}

/**
 * 선택 도서를 스크립트 퀴즈 생성 큐(book_quiz_jobs)에 적재.
 * RPC enqueue_quiz_jobs 가 자격(ready/published + 챕터 존재) 판정 + V-Level별 목표 문항 스냅샷.
 * 드레인(챕터 본문 → library_chapter_quiz INSERT)은 Claude Code 배치(MCP)가 수행.
 */
export async function enqueueQuizJobsAction(
  bookIds: string[],
): Promise<ActionResult<{ queued: number; skipped: number }>> {
  try {
    await requireAdmin('/admin/curation')
    if (bookIds.length === 0) {
      return { ok: true, data: { queued: 0, skipped: 0 } }
    }
    const client = (await createClient()) as unknown as SupabaseClient
    const result = await enqueueQuizJobs(client, bookIds)
    revalidatePath('/admin/curation')
    return { ok: true, data: result }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '퀴즈 큐 적재 실패',
    }
  }
}

/** 퀴즈 큐 상태 뷰용 — 최근 작업 목록 조회. */
export async function fetchQuizJobsAction(): Promise<ActionResult<QuizJobRow[]>> {
  try {
    await requireAdmin('/admin/curation')
    const client = (await createClient()) as unknown as SupabaseClient
    const jobs = await fetchQuizJobs(client)
    return { ok: true, data: jobs }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '퀴즈 큐 조회 실패',
    }
  }
}
