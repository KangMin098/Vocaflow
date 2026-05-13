// apps/web/src/lib/vcb/server/sources.ts
// Server Action — Source 조회 + 생성.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchSources as fetchSourcesCore,
  createSource as createSourceCore,
  type SourceSummary,
  type CreateSourceInput,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function fetchSources(): Promise<SourceSummary[]> {
  await requireAdmin('/admin/vocab')
  const client = await createClient()
  return fetchSourcesCore(client)
}

export async function createSource(
  input: CreateSourceInput,
): Promise<ServerActionResult<{ source_id: number }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const result = await createSourceCore(client, input)

    if (!result.ok || result.source_id === undefined) {
      return { ok: false, error: result.error ?? 'createSource failed' }
    }

    revalidatePath('/admin/vocab/sources')
    return { ok: true, data: { source_id: result.source_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
