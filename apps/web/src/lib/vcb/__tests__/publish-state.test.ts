// apps/web/src/lib/vcb/__tests__/publish-state.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, it, vi } from 'vitest'
vi.mock('../../../../../../packages/vcb-curate-core/src/precheck', () => ({ precheckPublish: vi.fn().mockResolvedValue({ ok: true, stats: { existing_max_version: 0 } }) }))
import { publishRun } from '../../../../../../packages/vcb-curate-core/src/publish'

type DbResult = { data: unknown; error: { message: string } | null }
function query(result: DbResult) {
  const chain = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: (value: DbResult) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of [chain.select, chain.eq, chain.in, chain.order, chain.range]) method.mockReturnValue(chain)
  return chain
}
function fixture(status: 'curating' | 'published' | 'publishing', start: DbResult, restoreError: { message: string } | null = null) {
  const updates: Array<{ payload: unknown; chain: ReturnType<typeof query> }> = []
  const from = vi.fn((table: string) => {
    if (table !== 'vocab_runs') return query({ data: [], error: null })
    const reader = query({ data: { id: 1, collection_slug: 'owned-test', collection_title: 'Owned test', status, config: { target_segment: 'general' } }, error: null })
    return { ...reader, update: (payload: unknown) => {
      const chain = query(updates.length === 0 ? start : { data: null, error: restoreError })
      updates.push({ payload, chain })
      return chain
    } }
  })
  return { client: { from } as unknown as SupabaseClient, from, updates }
}
it('does not publish after the publishing state write fails', async () => {
  const { client, from } = fixture('curating', { data: null, error: { message: 'state write denied' } })
  expect(await publishRun(client, 1, { published_by: null })).toMatchObject({ ok: false, error: expect.stringContaining('state write denied') })
  expect(from.mock.calls.map(([table]) => table)).toEqual(['vocab_runs', 'vocab_runs'])
})
it('requires the expected previous state to match before publishing', async () => {
  const { client, updates } = fixture('curating', { data: null, error: null })
  expect(await publishRun(client, 1, { published_by: null })).toMatchObject({ ok: false, error: expect.stringContaining('run status changed') })
  expect(updates[0].chain.eq).toHaveBeenCalledWith('status', 'curating')
})
it.each(['published', 'curating', 'publishing'] as const)('restores %s appropriately after an atomic publish failure', async status => {
  const { client, updates } = fixture(status, { data: { id: 1 }, error: null })
  expect(await publishRun(client, 1, { published_by: null })).toMatchObject({ ok: false, error: 'no publishable items' })
  expect(updates[1].payload).toEqual({ status: status === 'published' ? 'published' : 'curating' })
  expect(updates[1].chain.eq).toHaveBeenCalledWith('id', 1)
  expect(updates[1].chain.eq).toHaveBeenCalledWith('status', 'publishing')
})
it('reports state recovery failure together with the original publish failure', async () => {
  const { client } = fixture('curating', { data: { id: 1 }, error: null }, { message: 'recovery denied' })
  expect(await publishRun(client, 1, { published_by: null })).toMatchObject({ ok: false, error: 'no publishable items; run state recovery failed: recovery denied' })
})
