// apps/web/src/lib/vcb/server/qa.ts
// Server Action — VCB Step 6 QA Gate.

'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { performQaGate, type QaSummary } from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function runQaGate(
  run_id: number,
  opts?: { requeueFlagged?: boolean },
): Promise<ServerActionResult<QaSummary>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = createAdminClient()

    const result = await performQaGate(client, run_id, {
      requeueFlagged: opts?.requeueFlagged ?? false,
    })
    if (!result.ok || !result.summary) {
      return { ok: false, error: result.error ?? 'qa failed' }
    }

    revalidatePath(`/admin/vocab/runs/${run_id}`)
    return { ok: true, data: result.summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
