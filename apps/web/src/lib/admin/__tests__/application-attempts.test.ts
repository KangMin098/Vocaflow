// apps/web/src/lib/admin/__tests__/application-attempts.test.ts
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadApplicationAttempts, summarizeApplicationAttempts, type ApplicationAttempt } from '../application-attempts'

describe('적용 ID·버전별 수행 집계', () => {
  it('같은 버전의 비합성 표시만 계정·정답 집계에 쓰며 미상을 분리한다', () => {
    const row = { id: 1, user_id: 'a', synthetic: false, is_correct: true, phase: 'practice', response: { appVersion: 2 } }
    const rows: ApplicationAttempt[] = [row, { ...row, id: 2, synthetic: true }, { ...row, id: 3, synthetic: null }, { ...row, id: 4, response: { appVersion: 1 } }, { ...row, id: 5, response: null }, { ...row, id: 6, response: { appVersion: '2' } }]
    expect(summarizeApplicationAttempts(rows, 2)).toMatchObject({ current: 3, other: 1, unknown: 2, nonSynthetic: 1, synthetic: 1, syntheticUnknown: 1, accounts: 1, correct: 1 })
  })
  it('한 적용을 ID 커서로 끝까지 읽으며 1000행에서 자르지 않는다', async () => {
    const filters: unknown[][] = []
    let cursor: number | null = null
    const db = { from: () => {
      const q = { select: () => q, order: () => q, limit: () => q, eq: (...args: unknown[]) => { filters.push(args); return q }, gt: (_key: string, n: number) => { cursor = n; return q }, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: cursor === null ? Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })) : [{ id: 1001 }], error: null }).then(resolve) }
      return q
    } } as unknown as SupabaseClient
    expect(await loadApplicationAttempts(db, 'app')).toHaveLength(1001)
    expect(filters).toEqual([['application_id', 'app'], ['application_id', 'app']])
  })
  it('배열이 아닌 응답을 실제 0건으로 바꾸지 않는다', async () => {
    const db = { from: () => {
      const q = { select: () => q, order: () => q, limit: () => q, eq: () => q, then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve) }
      return q
    } } as unknown as SupabaseClient
    await expect(loadApplicationAttempts(db, 'app')).rejects.toThrow('배열')
  })
})
