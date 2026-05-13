// apps/web/src/lib/vcb/server/runs.ts
// Server Action — Run 조회.

'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchRuns as fetchRunsCore,
  fetchRunDetail as fetchRunDetailCore,
  type RunSummary,
  type RunDetail,
} from '@vocaflow/vcb-curate-core'

export async function fetchRuns(): Promise<RunSummary[]> {
  await requireAdmin('/admin/vocab')
  const client = await createClient()
  return fetchRunsCore(client)
}

export async function fetchRunDetail(runId: number): Promise<RunDetail | null> {
  await requireAdmin('/admin/vocab')
  const client = await createClient()
  return fetchRunDetailCore(client, runId)
}
