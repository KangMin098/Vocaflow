// apps/web/src/lib/vcb/server/run-create.ts
// Server Action — Run 생성.

'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  createRun as createRunCore,
  type CreateRunInput,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export async function createRun(
  input: CreateRunInput,
): Promise<ServerActionResult<{ run_id: number }>> {
  try {
    const user = await requireAdmin('/admin/vocab')
    const client = createAdminClient()

    const result = await createRunCore(client, input, { created_by: user.id })

    if (!result.ok || result.run_id === undefined) {
      return { ok: false, error: result.error ?? 'createRun failed' }
    }

    revalidatePath('/admin/vocab/runs')
    return { ok: true, data: { run_id: result.run_id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
