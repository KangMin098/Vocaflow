// apps/web/src/lib/topic-corpus/__tests__/drain-recovery.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
const harvest = vi.hoisted(() => vi.fn())
vi.mock('../harvest', () => ({ harvestTedTalk: harvest }))
import { drainTopicCorpusBatch } from '../drain'

beforeEach(() => { harvest.mockReset() })
const row = { id: 'owned-queue', source_id: 'owned-source', external_id: 'owned-talk', url: 'https://example.invalid/talks/owned-talk', title: 'Owned test' }
const failure = { ok: false, permanent: false, reason: 'upstream unavailable', externalId: row.external_id }
function client(release: () => Promise<unknown>) {
  const rpc = vi.fn(async (name: string) => name === 'claim_topic_corpus_batch' ? { data: [row], error: null } : release())
  const update = vi.fn()
  const query = { eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: row.id }, error: null }) }
  query.eq.mockReturnValue(query); query.select.mockReturnValue(query); update.mockReturnValue(query)
  return { db: { rpc, from: () => ({ update }) } as unknown as SupabaseClient, rpc, update, query }
}
it('reports a release RPC failure and does not count a permanent skip as persisted', async () => {
  harvest.mockResolvedValue({ ...failure, permanent: true })
  const { db } = client(async () => ({ data: null, error: { message: 'queue update denied' } }))
  const result = await drainTopicCorpusBatch(db, { max: 1 })
  expect(result).toMatchObject({ claimed: 1, skipped: 0, failed: 1, drained: false })
  expect(result.error).toContain('owned-queue: queue update denied')
  expect(result.results[0]).toMatchObject({ release_failed: true, release_error: 'queue update denied' })
})
it('reports a rejected release request without throwing away the batch result', async () => {
  harvest.mockResolvedValue(failure)
  const { db } = client(async () => { throw new Error('transport interrupted') })
  const result = await drainTopicCorpusBatch(db)
  expect(result.error).toContain('transport interrupted')
  expect(result.failed).toBe(1)
})
it('returns a retryable failure without a batch error after a successful release', async () => {
  harvest.mockResolvedValue(failure)
  const { db, rpc } = client(async () => ({ data: null, error: null }))
  const result = await drainTopicCorpusBatch(db)
  expect(result).toMatchObject({ failed: 1, skipped: 0, drained: false })
  expect(result.error).toBeUndefined()
  expect(rpc).toHaveBeenLastCalledWith('release_topic_corpus_claim', { p_id: row.id, p_status: 'pending', p_error: failure.reason })
})
it('closes the current claim for an already ingested document without ingesting it again', async () => {
  harvest.mockResolvedValue({ ok: true, externalId: row.external_id, alreadyIngested: true })
  const { db, rpc, update, query } = client(async () => { throw new Error('unexpected release') })
  const result = await drainTopicCorpusBatch(db, { now: () => '2026-10-21T00:00:00.000Z' })
  expect(result).toMatchObject({ harvested: 1, failed: 0 })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(update).toHaveBeenCalledWith({ status: 'done', claimed_at: null, completed_at: '2026-10-21T00:00:00.000Z', last_error: null })
  expect(query.eq).toHaveBeenCalledWith('id', row.id)
  expect(query.eq).toHaveBeenCalledWith('status', 'claimed')
})
it('reports replay closure failure rather than claiming a harvested queue was closed', async () => {
  harvest.mockResolvedValue({ ok: true, externalId: row.external_id, alreadyIngested: true })
  const { db, query } = client(async () => ({ error: null }))
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
  const result = await drainTopicCorpusBatch(db)
  expect(result).toMatchObject({ harvested: 0, failed: 1 })
  expect(result.error).toContain('queue claim changed')
})
