// apps/web/src/lib/csat/map/v4/__tests__/plan-store.test.ts
// rev4.0 4차 마감 — 이력 조회가 Workspace 마다 따로 최신 20버전을 가져오는지(한 묶음의 많은 버전이 다른 묶음 이력을 밀어내지 않는다) · 충돌 409 매핑.

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { commitPlan, loadSavedPlans } from '../plan-store'

type Row = Record<string, unknown>
const plan = (ws: string, v: number): Row => ({ workspace_id: ws, plan_version: v, plan: { order: [], tasks: [] }, reason: 'learner_adjust', note: null, restored_from: null, canon_version: 'c', as_of: '2026-10-11T00:00:00Z', created_at: '2026-10-11T00:00:00Z' })

/** 아주 작은 PostgREST 흉내 — eq · neq · in · order(desc) · limit 만 */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (t: string) => {
    let rows = [...(tables[t] ?? [])]
    let head = false
    const q: Record<string, unknown> = {
      select: (_c: string, o?: { head?: boolean }) => ((head = !!o?.head), q),
      eq: (k: string, v: unknown) => ((rows = rows.filter((r) => r[k] === v)), q),
      neq: (k: string, v: unknown) => ((rows = rows.filter((r) => r[k] !== v)), q),
      in: (k: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[k]))), q),
      order: (k: string, o?: { ascending?: boolean }) => ((rows = [...rows].sort((a, b) => (o?.ascending === false ? Number(b[k]) - Number(a[k]) : Number(a[k]) - Number(b[k])))), q),
      limit: (n: number) => ((rows = rows.slice(0, n)), q),
      then: (res: (v: unknown) => unknown) => res(head ? { error: null, count: rows.length } : { data: rows, error: null }),
    }
    return q
  }
  return { from } as never
}

describe('loadSavedPlans — Workspace 별 이력', () => {
  it('한 Workspace 에 버전 50개가 있어도 다른 Workspace 의 이력이 보인다', async () => {
    const plans = [...Array.from({ length: 50 }, (_, i) => plan('w1', i + 1)), plan('w2', 1), plan('w2', 2)]
    const db = fakeDb({
      learner_workspace: [{ id: 'w1', template_id: 'ws.a', user_id: 'u', status: 'active' }, { id: 'w2', template_id: 'ws.b', user_id: 'u', status: 'active' }],
      learner_workspace_plan: plans.map((p) => ({ ...p, user_id: 'u', id: 1 })),
      csat_map_goal_version: [],
    })
    const s = await loadSavedPlans(db, 'u')
    expect(s.byTemplate['ws.a'].history).toHaveLength(20)
    expect(s.byTemplate['ws.a'].latest.version).toBe(50)
    expect(s.byTemplate['ws.b'].history.map((h) => h.version)).toEqual([2, 1])
  })
})

describe('commitPlan — RPC 오류 매핑', () => {
  it('버전 충돌(PT409) → 409 conflict · 검증 실패 → 422', async () => {
    const rpc = (msg: string, code: string) => ({ rpc: async () => ({ data: null, error: { code, message: msg } }) }) as never
    const args = { userId: 'u', template: 't', templateTasks: ['a'], canon: 'c', plan: { order: [], tasks: [] } as never, reason: 'learner_adjust' as const, note: null, asOf: '2026-10-11T00:00:00Z', goalVersionId: null, expectedVersion: 1, clientKey: 'k', restoreOf: null }
    expect(await commitPlan(rpc('plan_version_conflict: expected 1, current 2', 'PT409'), args)).toMatchObject({ ok: false, status: 409, code: 'conflict' })
    expect(await commitPlan(rpc('plan_invalid: order', '22023'), args)).toMatchObject({ ok: false, status: 422, code: 'plan_invalid' })
    expect(await commitPlan(rpc('duplicate key value violates unique constraint "learner_workspace_plan_user_id_client_key_key"', '23505'), args)).toMatchObject({ ok: false, status: 409, code: 'client_key_reused' })
  })
})
