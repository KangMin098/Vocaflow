// apps/web/src/lib/vcb/server/curation.ts
// Server Action — 실 DB 호출.
// auth.uid() 추출 + admin/curator 권한 검증 + vcb-curate-core 호출.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  approveQueueItem as approveCore,
  rejectQueueItem as rejectCore,
  editQueueItem as editCore,
  reenrichQueueItem as reenrichCore,
  bulkApprove as bulkApproveCore,
  bulkReject as bulkRejectCore,
  type CurationContext,
  type QueuePayload,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

async function buildContext(): Promise<{
  client: Awaited<ReturnType<typeof createClient>>
  ctx: CurationContext
}> {
  const user = await requireAdmin('/admin/vocab')
  const client = await createClient()
  return {
    client,
    ctx: { decided_by: user.id },
  }
}

export async function approveQueueItem(
  queueId: number,
  note: string | null,
): Promise<ServerActionResult<{ decision_id: number }>> {
  try {
    const { client, ctx } = await buildContext()
    const result = await approveCore(client, queueId, note, ctx)
    if (!result.ok || result.decision_id === undefined) {
      return { ok: false, error: result.error ?? 'approve failed' }
    }
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return { ok: true, data: { decision_id: result.decision_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function rejectQueueItem(
  queueId: number,
  note: string | null,
): Promise<ServerActionResult<{ decision_id: number }>> {
  try {
    const { client, ctx } = await buildContext()
    const result = await rejectCore(client, queueId, note, ctx)
    if (!result.ok || result.decision_id === undefined) {
      return { ok: false, error: result.error ?? 'reject failed' }
    }
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return { ok: true, data: { decision_id: result.decision_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function editQueueItem(
  queueId: number,
  editedPayload: Partial<QueuePayload>,
  note: string | null,
): Promise<ServerActionResult<{ decision_id: number }>> {
  try {
    const { client, ctx } = await buildContext()
    const result = await editCore(client, queueId, editedPayload, note, ctx)
    if (!result.ok || result.decision_id === undefined) {
      return { ok: false, error: result.error ?? 'edit failed' }
    }
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return { ok: true, data: { decision_id: result.decision_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function reenrichQueueItem(
  queueId: number,
  note: string | null,
): Promise<ServerActionResult<{ decision_id: number; slash_command: string }>> {
  try {
    const { client, ctx } = await buildContext()
    const result = await reenrichCore(client, queueId, note, ctx)
    if (
      !result.ok ||
      result.decision_id === undefined ||
      !result.slash_command
    ) {
      return { ok: false, error: result.error ?? 'reenrich failed' }
    }
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return {
      ok: true,
      data: {
        decision_id: result.decision_id,
        slash_command: result.slash_command,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function bulkApprove(
  queueIds: number[],
): Promise<
  ServerActionResult<{ affected: number; failed: number; errors: string[] }>
> {
  try {
    const { client, ctx } = await buildContext()
    const result = await bulkApproveCore(client, queueIds, ctx)
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return {
      ok: result.ok,
      data: {
        affected: result.affected,
        failed: result.failed,
        errors: result.errors,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function bulkReject(
  queueIds: number[],
): Promise<
  ServerActionResult<{ affected: number; failed: number; errors: string[] }>
> {
  try {
    const { client, ctx } = await buildContext()
    const result = await bulkRejectCore(client, queueIds, ctx)
    revalidatePath('/admin/vocab/curate/[run_id]', 'page')
    return {
      ok: result.ok,
      data: {
        affected: result.affected,
        failed: result.failed,
        errors: result.errors,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
