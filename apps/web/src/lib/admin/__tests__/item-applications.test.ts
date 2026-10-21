// apps/web/src/lib/admin/__tests__/item-applications.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/knowledge/item-tasks', () => ({ ITEM_TASKS: [{ key: 'first' }, { key: 'second' }] }))
vi.mock('@/lib/knowledge/product-server', () => ({ itemTaskRef: (key: string, id: string) => `${key}:${id}` }))
import { loadAdminItemApplications } from '../item-applications'

describe('기출 문항과 실제 적용의 결속', () => {
  it('표면·정확한 문항 TASK 참조로 제한하며 중단·과거 적용도 조회한다', async () => {
    const eq = vi.fn(), within = vi.fn()
    const rows = [{ id: 'app-paused', surface_ref: 'first:2026#31', status: 'paused', version: 2 }]
    const chain = { select: () => chain, eq: (...args: unknown[]) => { eq(...args); return chain }, in: (...args: unknown[]) => { within(...args); return chain }, order: () => chain, limit: () => Promise.resolve({ data: rows, error: null }) }
    const db = { from: vi.fn(() => chain) } as unknown as SupabaseClient
    expect(await loadAdminItemApplications(db, '2026#31')).toEqual({ state: 'loaded', rows })
    expect(eq.mock.calls).toEqual([['surface', 'csat_item_task']])
    expect(within).toHaveBeenCalledWith('surface_ref', ['first:2026#31', 'second:2026#31'])
  })
  it('정상 0건과 조회 실패를 구분한다', async () => {
    const db = (error: unknown) => {
      const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => Promise.resolve({ data: error ? null : [], error }) }
      return { from: () => chain } as unknown as SupabaseClient
    }
    expect((await loadAdminItemApplications(db(null), '2026#31')).state).toBe('loaded')
    expect((await loadAdminItemApplications(db({ message: 'failed' }), '2026#31')).state).toBe('error')
    expect((await loadAdminItemApplications({ from: () => { throw Error('network') } } as unknown as SupabaseClient, '2026#31')).state).toBe('error')
  })
})
