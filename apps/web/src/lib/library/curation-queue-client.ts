// apps/web/src/lib/library/curation-queue-client.ts
import type { CurationJobRow, QuizJobRow, ReviewJobRow } from './admin-queries'

interface QueueRows { voice: CurationJobRow[]; quiz: QuizJobRow[]; review: ReviewJobRow[] }
type QueueResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Read polling must not enter Next's Server Action navigation/refresh queue. */
export async function readCurationQueue<K extends keyof QueueRows>(kind: K): Promise<QueueResult<QueueRows[K]>> {
  try {
    const response = await fetch(`/api/admin/library/curation-jobs?kind=${kind}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok || body.ok !== true || !Array.isArray(body.data)) {
      return { ok: false, error: body.message ?? body.error ?? '큐 상태를 불러오지 못했습니다.' }
    }
    return { ok: true, data: body.data }
  } catch {
    return { ok: false, error: '큐 상태를 불러오지 못했습니다.' }
  }
}
