// apps/web/src/lib/csat/map/v62/__tests__/supply-store.test.ts
// v6.2 P-F8e — 영속 기록 읽기: 표 없음 → not_installed · 오류 → error · 남의 Workspace → 빈 기록 · 모든 행을 세션 사용자로 거른다
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { loadSupplyLedger } from '../supply-store'

type Res = { data?: unknown; error?: { code?: string; message?: string } | null }
/** 표마다 응답을 정하는 가짜 클라이언트 — 걸린 필터를 기록한다 */
function fakeDb(byTable: Record<string, Res>) {
  const filters: Record<string, [string, unknown][]> = {}
  const from = (table: string) => {
    filters[table] ??= []
    const res = { data: null, error: null, ...byTable[table] }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'limit', 'neq']) chain[m] = () => chain
    chain.eq = (col: string, v: unknown) => { filters[table]!.push([col, v]); return chain }
    chain.maybeSingle = async () => res
    chain.then = (ok: (r: Res) => unknown) => Promise.resolve(res).then(ok)
    return chain
  }
  return { db: { from } as unknown as SupabaseClient, filters }
}
const U = 'user-1'
const WS = 'ws-1'

describe('loadSupplyLedger', () => {
  it('표가 없으면 not_installed(PGRST205 · 42P01)', async () => {
    for (const code of ['PGRST205', '42P01']) {
      const { db } = fakeDb({ factory_order: { error: { code } } })
      expect(await loadSupplyLedger(db, U, WS)).toEqual({ status: 'not_installed' })
    }
  })
  it('그 밖의 오류는 error(「없음」으로 삼키지 않는다)', async () => {
    const { db } = fakeDb({ factory_order: { error: { code: '57014' } } })
    expect(await loadSupplyLedger(db, U, WS)).toEqual({ status: 'error' })
  })
  it('남의 · 닫힌 Workspace 는 기록을 보이지 않는다', async () => {
    const { db } = fakeDb({ factory_order: {}, learner_workspace: { data: null } })
    expect(await loadSupplyLedger(db, U, WS)).toEqual({ status: 'installed', lines: {} })
  })
  it('최신 주문 · 공급 수를 줄별로 모으고, 모든 표를 세션 사용자 · Workspace 로 거른다', async () => {
    const { db, filters } = fakeDb({
      factory_order: { data: [{ line_id: 'L1', state: 'failed', order_seq: 1 }, { line_id: 'L1', state: 'producing', order_seq: 2 }] },
      learner_workspace: { data: { id: WS } },
      workspace_content_demand_line: { data: [{ id: 'L1', role: 'guided_practice', task_id: 'r.flow_order' }, { id: 'L2', role: 'independent_check', task_id: 'r.flow_order' }] },
      workspace_content_delivery: { data: [{ line_id: 'L2' }, { line_id: 'L2' }, { line_id: 'X' }] },
    })
    expect(await loadSupplyLedger(db, U, WS)).toEqual({
      status: 'installed',
      lines: {
        'r.flow_order|guided_practice': { order: { state: 'producing', seq: 2 }, delivered: 0 },
        'r.flow_order|independent_check': { order: null, delivered: 2 },
      },
    })
    for (const t of ['learner_workspace', 'workspace_content_demand_line', 'factory_order', 'workspace_content_delivery']) {
      expect(filters[t]!.some(([c, v]) => c === 'user_id' && v === U), t).toBe(true)
    }
  })
  it('저장된 Workspace 가 없으면 조회하지 않는다', async () => {
    const { db, filters } = fakeDb({})
    expect(await loadSupplyLedger(db, U, null)).toEqual({ status: 'installed', lines: {} })
    expect(Object.keys(filters)).toEqual([])
  })
})
