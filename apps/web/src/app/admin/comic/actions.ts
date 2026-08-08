// apps/web/src/app/admin/comic/actions.ts
// CCP admin Server Actions — 큐 적재 / 발행·회수. requireAdmin 게이트.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { archiveComic, collectComicStoragePaths, deleteComic, enqueueComicJobs, setComicPublished } from '@/lib/comic/admin-queries'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function enqueueComicJobsAction(
  bookIds: string[],
): Promise<ActionResult<{ queued: number; skipped: number }>> {
  try {
    await requireAdmin('/admin/comic')
    const client = (await createClient()) as unknown as SupabaseClient
    const data = await enqueueComicJobs(client, bookIds)
    revalidatePath('/admin/comic')
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '큐 적재 실패' }
  }
}

export async function setComicPublishedAction(
  bookId: string,
  published: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin('/admin/comic')
    const client = (await createClient()) as unknown as SupabaseClient
    await setComicPublished(client, bookId, published)
    revalidatePath('/admin/comic')
    revalidatePath(`/admin/comic/${bookId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '발행 상태 변경 실패' }
  }
}

export async function archiveComicAction(
  bookId: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin('/admin/comic')
    const client = (await createClient()) as unknown as SupabaseClient
    await archiveComic(client, bookId, archived)
    revalidatePath('/admin/comic')
    revalidatePath(`/admin/comic/${bookId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '보관 상태 변경 실패' }
  }
}

export async function deleteComicAction(bookId: string): Promise<ActionResult> {
  try {
    await requireAdmin('/admin/comic')
    const client = (await createClient()) as unknown as SupabaseClient
    // 버킷 오브젝트 먼저 정리(고아 스토리지 방지) — best-effort, 실패해도 DB 삭제는 진행
    try {
      const st = await collectComicStoragePaths(client, bookId)
      if (st && st.paths.length > 0) await client.storage.from(st.bucket).remove(st.paths)
    } catch { /* 스토리지 정리 실패는 무시 */ }
    await deleteComic(client, bookId)
    revalidatePath('/admin/comic')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' }
  }
}
