// apps/web/src/lib/library/story/admin-reader.ts
import { describeStoryCode } from './messages'
import type { StoryBundle, StoryFailure, StoryResult, StorySlotRow } from './types'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const failure = (code: string): StoryFailure => ({ ok: false, code, ...describeStoryCode(code), stage: 'rpc', issues: [] })

function storyFailure(value: Record<string, unknown>): value is Record<string, unknown> & StoryFailure {
  return value.ok === false && typeof value.code === 'string' && typeof value.message === 'string'
    && typeof value.recovery === 'string' && typeof value.retryable === 'boolean' && typeof value.stage === 'string' && Array.isArray(value.issues)
}

/** Initial reads/refreshes must stay outside Next's Server Action navigation queue. */
async function read<T>(query: URLSearchParams, valid: (data: unknown) => boolean): Promise<StoryResult<T>> {
  try {
    const response = await fetch(`/api/admin/library/story?${query}`, { cache: 'no-store', credentials: 'same-origin' })
    const body: unknown = await response.json()
    if (!record(body)) return failure('rpc_unexpected_response')
    if (storyFailure(body)) return body
    if (!response.ok || body.ok !== true || !record(body.viewer) || typeof body.viewer.uid !== 'string'
      || !['admin', 'curator'].includes(String(body.viewer.role)) || !valid(body.data)) return failure('rpc_unexpected_response')
    return body as unknown as StoryResult<T>
  } catch {
    return failure('network_failed')
  }
}

export function readStorySlots(): Promise<StoryResult<{ slots: StorySlotRow[] }>> {
  return read(new URLSearchParams({ kind: 'slots' }), data => record(data) && Array.isArray(data.slots))
}

export function readStoryBundle(editionVersionId: string): Promise<StoryResult<StoryBundle>> {
  return read(new URLSearchParams({ kind: 'bundle', edition_version_id: editionVersionId }), data => record(data) && record(data.version) && data.version.id === editionVersionId)
}
