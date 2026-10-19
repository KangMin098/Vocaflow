// apps/web/src/lib/csat/map/v62/__tests__/supply-store.test.ts
// v6.2 P-F8e — 영속 기록 읽기: 표 없음 → not_installed · 오류 → error · 남의 Workspace → 빈 기록 · 모든 행을 세션 사용자로 거른다
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { loadSupplyLedger } from '../supply-store'

type Res = { data?: unknown; error?: { code?: string; message?: string } | null }
/** 표마다 응답을 정하는 가짜 클라이언트 — 걸린 필터를 기록한다 */
function fakeDb(byTable: Record<string, Res>, respond: (fn: string, args: Record<string, unknown>) => Res = () => ({ error: { code: 'PGRST202' } })) {
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
  const calls: Record<string, unknown>[] = []
  const rpcFn = async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, ...args }); return { data: null, error: null, ...respond(fn, args) } }
  return { db: { from, rpc: rpcFn } as unknown as SupabaseClient, filters, calls }
}
const U = 'user-1'
const WS = 'ws-1'

describe('loadSupplyLedger', () => {
  it('관리자 소유 조회와 세션이 필요한 충족도 RPC의 클라이언트를 분리한다', async () => {
    const admin = fakeDb({
      factory_order: { data: [] }, learner_workspace: { data: { id: WS } },
      workspace_content_demand_line: { data: [{ id: 'L1', role: 'independent_check', task_id: 'r.flow_order', workspace_content_demand: { canonical: 'D' } }] },
      workspace_content_delivery: { data: [{ line_id: 'L1' }] },
    }, () => ({ error: { code: '42501', message: 'Forbidden: missing auth.uid()' } }))
    const rpc = vi.fn().mockResolvedValue({ data: [{ requested: 3, delivered_valid: 1 }], error: null })
    const session = { rpc } as unknown as Pick<SupabaseClient, 'rpc'>
    expect(await loadSupplyLedger(admin.db, U, WS, session)).toEqual({ status: 'installed', lines: {
      'r.flow_order|independent_check|D': { order: null, delivered: 1, requested: 3, validDelivered: 1 },
    } })
    expect(rpc).toHaveBeenCalledWith('workspace_line_fulfillment', { p_line: 'L1' })
    expect(admin.calls).toEqual([])
    expect(admin.filters.learner_workspace).toContainEqual(['user_id', U])
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    expect(await loadSupplyLedger(admin.db, U, WS, session)).toEqual({ status: 'error' })
  })
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
      workspace_content_demand_line: { data: [{ id: 'L1', role: 'guided_practice', task_id: 'r.flow_order', quantity: 3, workspace_content_demand: { canonical: 'D' } }, { id: 'L2', role: 'independent_check', task_id: 'r.flow_order', quantity: 5, workspace_content_demand: { canonical: 'D' } }] },
      workspace_content_delivery: { data: [{ line_id: 'L2' }, { line_id: 'L2' }, { line_id: 'X' }] },
    }, (_fn, a) => ({ data: [{ requested: 5, delivered_total: 2, delivered_valid: a.p_line === 'L2' ? 2 : 0, shortfall: 3 }] }))
    expect(await loadSupplyLedger(db, U, WS)).toEqual({
      status: 'installed',
      lines: {
        'r.flow_order|guided_practice|D': { order: { state: 'producing', seq: 2 }, delivered: 0 },
        'r.flow_order|independent_check|D': { order: null, delivered: 2, requested: 5, validDelivered: 2 },
      },
    })
    for (const t of ['learner_workspace', 'workspace_content_demand_line', 'factory_order', 'workspace_content_delivery']) {
      expect(filters[t]!.some(([c, v]) => c === 'user_id' && v === U), t).toBe(true)
    }
  })
  it('I1-P 충족도 함수가 없으면(P 미적용) 수량 확인 전(null), 그 밖의 오류는 error, 공급 없는 줄은 묻지 않는다', async () => {
    const tables = {
      factory_order: { data: [] }, learner_workspace: { data: { id: WS } },
      workspace_content_demand_line: { data: [{ id: 'L2', role: 'independent_check', task_id: 'r.flow_order', quantity: 5, workspace_content_demand: { canonical: 'D' } }] },
      workspace_content_delivery: { data: [{ line_id: 'L2' }] },
    }
    const missing = fakeDb(tables)
    expect(await loadSupplyLedger(missing.db, U, WS)).toEqual({ status: 'installed', lines: { 'r.flow_order|independent_check|D': { order: null, delivered: 1, requested: null, validDelivered: null } } })
    const broken = fakeDb(tables, () => ({ error: { code: '57014' } }))
    expect(await loadSupplyLedger(broken.db, U, WS)).toEqual({ status: 'error' })
    const none = fakeDb({ ...tables, workspace_content_delivery: { data: [] } })
    await loadSupplyLedger(none.db, U, WS)
    expect(none.calls).toEqual([])
  })
  it('저장된 Workspace 가 없으면 조회하지 않는다', async () => {
    const { db, filters } = fakeDb({})
    expect(await loadSupplyLedger(db, U, null)).toEqual({ status: 'installed', lines: {} })
    expect(Object.keys(filters)).toEqual([])
  })
  it('R03 이전 수요 2개를 신규 PLAN 수요 3개의 완료로 합산하지 않는다(현재 canonical 경계)', async () => {
    const { db } = fakeDb({
      learner_workspace: { data: { id: WS } },
      factory_order: { data: [{ line_id: 'OLD', state: 'delivered', order_seq: 9 }, { line_id: 'NEW', state: 'requested', order_seq: 1 }] },
      workspace_content_demand_line: { data: [
        { id: 'OLD', role: 'guided_practice', task_id: 'r.flow_order', quantity: 2, workspace_content_demand: { canonical: 'PLAN1' } },
        { id: 'NEW', role: 'guided_practice', task_id: 'r.flow_order', quantity: 3, workspace_content_demand: { canonical: 'PLAN2' } },
      ] },
      workspace_content_delivery: { data: [{ line_id: 'OLD' }, { line_id: 'OLD' }] },
    }, () => ({ data: [{ requested: 2, delivered_total: 2, delivered_valid: 2, shortfall: 0 }] }))
    const got = await loadSupplyLedger(db, U, WS)
    expect(got).toEqual({ status: 'installed', lines: {
      'r.flow_order|guided_practice|PLAN1': { order: { state: 'delivered', seq: 9 }, delivered: 2, requested: 2, validDelivered: 2 },
      'r.flow_order|guided_practice|PLAN2': { order: { state: 'requested', seq: 1 }, delivered: 0 },
    } })
  })
})
