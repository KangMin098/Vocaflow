// apps/web/src/lib/vcb/server/method-a.ts
// Server Actions — VCB Method A (Step 2 Ingest + Step 3 Extract combined).

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  listMethodASources as listMethodASourcesCore,
  runMethodAExtract as runMethodAExtractCore,
  type MethodASourceListItem,
  type MethodAExtractResult,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function listMethodASources(
  run_id: number,
): Promise<ServerActionResult<{ sources: MethodASourceListItem[] }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const sources = await listMethodASourcesCore(client, run_id)
    return { ok: true, data: { sources } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export async function runMethodAExtract(
  run_id: number,
  source_id: number,
): Promise<ServerActionResult<MethodAExtractResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const result = await runMethodAExtractCore(client, run_id, source_id)
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'extract failed' }
    }
    revalidatePath(`/admin/vocab/runs/${run_id}`)
    return { ok: true, data: result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
