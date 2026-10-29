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

// T-0244 — teacher 실DB 통합 검사 두 개도 같은 승인 gate 를 AND 로 탄다(자격 증명만으로는 실행하지 않는다).
// 정적 경계: skip 조건에 gate · client 생성 · 로그인 · RPC · INSERT/DELETE · 정리는 모두 그 describe 안(beforeAll/afterAll/it)에만.
describe('teacher 실DB suite 의 승인 gate(T-0244)', () => {
  const read = async (rel: string) => (await import('node:fs')).readFileSync((await import('node:path')).resolve(__dirname, rel), 'utf8')
  const SUITES = [
    { file: '../../lib/teacher/__tests__/assignment-rls.integration.test.ts', cond: /const skip = !SUPABASE_URL \|\| !ANON_KEY \|\| !SERVICE_KEY \|\| !allowMutatingSharedDbTests\(process\.env\)/, gate: 'describe.skipIf(skip)(' },
    { file: '../../lib/teacher/__tests__/invite-rpc.integration.test.ts', cond: /const skipIfNoEnv = !URL_BASE \|\| !ANON \|\| !allowMutatingSharedDbTests\(process\.env\)/, gate: 'describe.skipIf(skipIfNoEnv)(' },
  ]
  for (const s of SUITES) {
    it(`${s.file.split('/').pop()}: skip 조건에 gate 를 AND · 부작용 호출은 gate 된 describe 안에만`, async () => {
      const src = await read(s.file)
      expect(src).toContain("import { allowMutatingSharedDbTests } from '@/test/shared-db-test-policy'")
      expect(src).toMatch(s.cond)
      const at = src.indexOf(s.gate)
      expect(at).toBeGreaterThan(0)
      const head = src.slice(0, at)
      // describe 밖(파일 맨 위)에서는 client 를 만들거나 호출하지 않는다 — 함수 정의 안의 createClient 만 허용
      const outside = head.replace(/function anonClient\(\)[\s\S]*?\n\}\n/, '')
      expect(outside).not.toMatch(/createClient\(|\.rpc\(|signInWithPassword|\.insert\(|\.delete\(|beforeAll\(|afterAll\(/)
      // gate 된 describe 앞(파일 맨 위)에는 다른 describe · it 이 없다 — 안쪽 describe 는 gate 아래라 함께 건너뛴다
      expect(head).not.toMatch(/\bdescribe\(|\bit\(/)
    })
  }
  it('gate 의미 — credentials 만으로는 거짓 · CI 에서는 opt-in 이어도 거짓 · 승인된 로컬 opt-in 만 참', () => {
    const creds = { NEXT_PUBLIC_SUPABASE_URL: 'http://x', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k', SUPABASE_SERVICE_ROLE_KEY: 's' }
    expect(allowMutatingSharedDbTests(creds)).toBe(false)
    expect(allowMutatingSharedDbTests({ ...creds, RUN_MUTATING_DB_TESTS: '1', CI: '1' })).toBe(false)
    expect(allowMutatingSharedDbTests({ ...creds, RUN_MUTATING_DB_TESTS: '1' })).toBe(true)
  })
})
