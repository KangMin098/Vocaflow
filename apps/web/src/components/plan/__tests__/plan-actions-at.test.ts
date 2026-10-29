// apps/web/src/components/plan/__tests__/plan-actions-at.test.ts
// T-0251 — 저장 · 삭제가 성공하면 쓰기를 마친 서버 시각(at)을 돌려준다(화면이 그보다 먼저 출발한 snapshot 을 버리는 기준). 실패에는 at 이 없다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const st = vi.hoisted(() => ({ user: 'user-a' as string | null, err: null as null | { message: string } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: st.user ? { id: st.user } : null }, error: null }) },
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const k of ['select', 'eq', 'in', 'not', 'order', 'single', 'insert', 'update', 'delete']) chain[k] = () => chain
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: st.err ? null : { id: 'new-1' }, error: st.err }).then(ok)
      return chain
    },
  }),
}))
vi.mock('@/lib/learner/plan-material-queries', () => ({ fetchPlanBooks: vi.fn(), fetchPlanCuratedSets: vi.fn(), fetchPlanChapterSets: vi.fn() }))

import { removePlanItem, savePlanItem } from '@/lib/learner/plan-actions'

const NOW = new Date('2026-10-29T07:00:00.000Z').getTime()
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  st.user = 'user-a'
  st.err = null
})
afterEach(() => vi.useRealTimers())

describe('쓰기 서버 시각 at', () => {
  it('추가 · 수정 · 삭제 성공 → at = 쓰기를 마친 서버 시각', async () => {
    expect(await savePlanItem({ materialType: 'book', materialId: 'b1', modules: ['read'], expectedOwner: 'user-a' })).toEqual({ ok: true, id: 'new-1', at: NOW })
    expect(await savePlanItem({ id: 'p1', materialType: 'book', materialId: 'b1', modules: ['read'] })).toEqual({ ok: true, id: 'p1', at: NOW })
    expect(await removePlanItem('p1', 'user-a')).toEqual({ ok: true, at: NOW })
  })
  it('실패(DB 오류 · 계정 불일치 · 비로그인)에는 at 이 없다', async () => {
    st.err = { message: 'boom' }
    expect((await savePlanItem({ materialType: 'book', materialId: 'b1', modules: ['read'] })).at).toBeUndefined()
    st.err = null
    expect((await savePlanItem({ materialType: 'book', materialId: 'b1', modules: ['read'], expectedOwner: 'user-b' })).at).toBeUndefined()
    st.user = null
    expect((await removePlanItem('p1')).at).toBeUndefined()
  })
})
