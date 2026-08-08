// apps/web/src/app/admin/comic/actions.ts
// CCP admin Server Actions — 큐 적재 / 발행·회수. requireAdmin 게이트.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { enqueueComicJobs, setComicPublished } from '@/lib/comic/admin-queries'

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
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '발행 상태 변경 실패' }
  }
}
