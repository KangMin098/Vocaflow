// apps/web/src/lib/vcb/server/dict-lookup.ts
// Server Action — VCB Step 4 Dictionary Lookup.

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { performDictLookup, type DictLookupSummary } from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function runDictionaryLookup(
  run_id: number,
): Promise<ServerActionResult<DictLookupSummary>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const result = await performDictLookup(client, run_id)
    if (!result.ok || !result.summary) {
      return { ok: false, error: result.error ?? 'dict-lookup failed' }
    }

    revalidatePath(`/admin/vocab/runs/${run_id}`)
    return { ok: true, data: result.summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
