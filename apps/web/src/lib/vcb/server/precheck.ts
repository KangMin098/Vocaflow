// apps/web/src/lib/vcb/server/precheck.ts
// Server Action — Publish precheck (실 DB).

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { precheckPublish, type PrecheckResult } from '@vocaflow/vcb-curate-core'

export async function precheckRun(runId: number): Promise<PrecheckResult> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  return precheckPublish(client, runId)
}
