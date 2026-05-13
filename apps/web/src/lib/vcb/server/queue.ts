// apps/web/src/lib/vcb/server/queue.ts
// Server Action — Queue list / detail 조회.

'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchQueueItems as fetchQueueItemsCore,
  fetchQueueDetail as fetchQueueDetailCore,
  type QueueListItem,
  type QueueDetail,
  type CurationFilter,
  type CurationSort,
} from '@vocaflow/vcb-curate-core'

export async function fetchQueueItems(
  runId: number,
  options?: {
    filter?: CurationFilter
    sort?: CurationSort
    limit?: number
    offset?: number
  },
): Promise<QueueListItem[]> {
  await requireAdmin('/admin/vocab')
  const client = await createClient()
  return fetchQueueItemsCore(client, {
    run_id: runId,
    filter: options?.filter,
    sort: options?.sort,
    limit: options?.limit,
    offset: options?.offset,
  })
}

export async function fetchQueueDetail(
  queueId: number,
): Promise<QueueDetail | null> {
  await requireAdmin('/admin/vocab')
  const client = await createClient()
  return fetchQueueDetailCore(client, queueId)
}
