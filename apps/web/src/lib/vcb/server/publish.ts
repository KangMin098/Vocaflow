// apps/web/src/lib/vcb/server/publish.ts
// Server Action — VCB Step 8 Publish.

'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { publishRun, type PublishResult } from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function runPublish(
  run_id: number,
): Promise<ServerActionResult<PublishResult>> {
  try {
    const user = await requireAdmin('/admin/vocab')
    const client = createAdminClient()

    const result = await publishRun(client, run_id, { published_by: user.id })
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'publish failed' }
    }

    revalidatePath(`/admin/vocab/runs/${run_id}`)
    revalidatePath('/admin/vocab/runs')
    return { ok: true, data: result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
