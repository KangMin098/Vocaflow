// apps/web/src/test/__tests__/shared-db-test-policy.test.ts
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { allowMutatingSharedDbTests } from '../shared-db-test-policy'
import { probeDbEventAllowlist } from '../db-allowlist-probe'

const RUN = '00000000-0000-4000-8000-000000000001'
const approved = { RUN_MUTATING_DB_TESTS: '1' }
function fake(insertError: string | null = null, cleanupError: string | null = null, missing = false, remaining: number | null = 0) {
  const filters: unknown[][] = []
  const readFilters: unknown[][] = []
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: missing ? [] : [{ id: 1 }, { id: 2 }], error: insertError ? { message: insertError } : null }) })
  const query = { eq: (...args: unknown[]) => { filters.push(args); return query }, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ error: cleanupError ? { message: cleanupError } : null }).then(resolve) }
  const remove = vi.fn().mockReturnValue(query)
  const read = { eq: (...args: unknown[]) => { readFilters.push(args); return read }, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ error: null, count: remaining }).then(resolve) }
  const from = vi.fn().mockReturnValue({ insert, delete: remove, select: vi.fn().mockReturnValue(read) })
  return { db: { from } as unknown as SupabaseClient, from, insert, remove, filters, readFilters }
}
describe('shared DB mutation test boundary', () => {
  it.each([{}, { MAP_LIVE_USER: RUN }, { RUN_MUTATING_DB_TESTS: 'true' }, { ...approved, CI: '1' }, { ...approved, CI: 'true' }, { ...approved, CI: '0' }])('defaults and CI cannot enable writes: %j', async env => {
    const f = fake()
    expect(allowMutatingSharedDbTests(env)).toBe(false)
    await expect(probeDbEventAllowlist(f.db, ['a', 'b'], RUN, env)).rejects.toThrow('명시적')
    expect(f.from).not.toHaveBeenCalled()
  })
  it('uses one batch and cleans only this run, preserving other selftest rows', async () => {
    const f = fake()
    await probeDbEventAllowlist(f.db, ['a', 'b'], RUN, approved)
    expect(f.insert).toHaveBeenCalledTimes(1)
    expect(f.insert).toHaveBeenCalledWith(['a', 'b'].map(event => ({ user_id: null, event, surface: 'selftest', meta: { selftest_run_id: RUN } })))
    expect(f.filters).toEqual([['surface', 'selftest'], ['meta->>selftest_run_id', RUN]])
    expect(f.readFilters).toEqual(f.filters)
    expect(f.remove).toHaveBeenCalledTimes(1)
  })
  it('keeps insert and cleanup failures visible and cleanup remains scoped', async () => {
    const f = fake('insert failed', 'cleanup failed')
    await expect(probeDbEventAllowlist(f.db, ['a', 'b'], RUN, approved)).rejects.toThrow('insert failed / 검사 실행 정리 실패: cleanup failed')
    expect(f.filters).toContainEqual(['meta->>selftest_run_id', RUN])
  })
  it('does not call missing response a success', async () => {
    const f = fake(null, null, true)
    await expect(probeDbEventAllowlist(f.db, ['a', 'b'], RUN, approved)).rejects.toThrow('응답 누락')
    expect(f.remove).toHaveBeenCalledTimes(1)
  })
  it.each([['invalid', ['a']], [RUN, []]] as const)('rejects invalid ownership or an empty probe before DB calls', async (id, events) => {
    const f = fake()
    await expect(probeDbEventAllowlist(f.db, events, id, approved)).rejects.toThrow('실행 ID와 이벤트')
    expect(f.from).not.toHaveBeenCalled()
  })
  it.each([null, 1])('does not mistake a silent/unknown delete result for complete cleanup: %s', async remaining => {
    const f = fake(null, null, false, remaining)
    await expect(probeDbEventAllowlist(f.db, ['a', 'b'], RUN, approved)).rejects.toThrow('잔여 확인 실패')
    expect(f.readFilters).toEqual([['surface', 'selftest'], ['meta->>selftest_run_id', RUN]])
  })
})
