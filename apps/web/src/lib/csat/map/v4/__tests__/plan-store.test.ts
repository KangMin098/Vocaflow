// apps/web/src/lib/csat/map/v4/__tests__/plan-store.test.ts
// rev4.0 4차 마감 — 이력 조회가 Workspace 마다 따로 최신 20버전을 가져오는지(한 묶음의 많은 버전이 다른 묶음 이력을 밀어내지 않는다) · 충돌 409 매핑.

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { commitPlan, loadLatestGoal, loadSavedPlans } from '../plan-store'

type Row = Record<string, unknown>
const plan = (ws: string, v: number): Row => ({ workspace_id: ws, plan_version: v, plan: { order: [], tasks: [] }, reason: 'learner_adjust', note: null, restored_from: null, canon_version: 'c', as_of: '2026-10-11T00:00:00Z', created_at: '2026-10-11T00:00:00Z' })

/** 아주 작은 PostgREST 흉내 — eq · neq · in · order(desc) · limit 만 */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (t: string) => {
    let rows = [...(tables[t] ?? [])]
    let head = false
    let take = Number.POSITIVE_INFINITY
    const q: Record<string, unknown> = {
      select: (_c: string, o?: { head?: boolean }) => ((head = !!o?.head), q),
      eq: (k: string, v: unknown) => ((rows = rows.filter((r) => r[k] === v)), q),
      lt: (k: string, v: unknown) => ((rows = rows.filter((r) => Number(r[k]) < Number(v))), q),
      neq: (k: string, v: unknown) => ((rows = rows.filter((r) => r[k] !== v)), q),
      in: (k: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[k]))), q),
      order: (k: string, o?: { ascending?: boolean }) => ((rows = [...rows].sort((a, b) => (o?.ascending === false ? Number(b[k]) - Number(a[k]) : Number(a[k]) - Number(b[k])))), q),
      limit: (n: number) => ((take = n), q),
      then: (res: (v: unknown) => unknown) => res(head ? { error: null, count: rows.length } : { data: rows.slice(0,take), error: null }),
    }
    return q
  }
  return { from } as never
}

describe('loadSavedPlans — Workspace 별 이력', () => {
  it('목표는 사용자 잠금 안의 insert 버전 순서 — transaction start 시각 역전과 분리', async () => {
    const db = fakeDb({ csat_map_goal_version: [
      { id: 101, user_id: 'u', target_score: 80, created_at: 200 },
      { id: 102, user_id: 'u', target_score: 90, created_at: 100 },
    ] })
    expect((await loadLatestGoal(db, 'u'))?.score).toBe(90)
    expect((await loadSavedPlans(db, 'u')).goalVersionId).toBe(102)
  })
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

it('full scoped history retains transfer choice beyond20 UI versions and1000 server rows',async()=>{
 const rows: Row[]=Array.from({length:1002},(_,i)=>({...plan('w1',i+1),user_id:'u'}))
 rows[0].plan={order:['r.central_meaning'],tasks:[{task:'r.central_meaning',stage:'repair',planned:2}]}
 rows[1].plan={order:['r.central_meaning'],tasks:[{task:'r.central_meaning',stage:'transfer',planned:1}]}
 const db=fakeDb({learner_workspace:[{id:'w1',template_id:'ws.central-meaning',user_id:'u',status:'active'}],learner_workspace_plan:rows,csat_map_goal_version:[]})
 const s=await loadSavedPlans(db,'u')
 expect(s.byTemplate['ws.central-meaning'].history).toHaveLength(20)
 expect(s.byTemplate['ws.central-meaning'].latest.version).toBe(1002)
 expect(s.byTemplate['ws.central-meaning'].transferPlanned?.['r.central_meaning']).toBe(1)
 expect(s.byTemplate['ws.central-meaning'].transferPolicies?.[1]?.['r.central_meaning']).toBe(2)
 expect(s.byTemplate['ws.central-meaning'].transferPolicies?.[2]?.['r.central_meaning']).toBe(1)
 expect(s.byTemplate['ws.central-meaning'].transferPolicies?.[1002]?.['r.central_meaning']).toBe(1)
})
