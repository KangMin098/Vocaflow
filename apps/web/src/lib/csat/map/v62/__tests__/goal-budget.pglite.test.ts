// apps/web/src/lib/csat/map/v62/__tests__/goal-budget.pglite.test.ts
// Real legacy + proposed SQL in disposable memory. No shared DB writes. Single connection is not a concurrency proof.
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GoalConflictError, setGoal } from '../../server'
import { GoalBudgetUnavailableError, GoalVersionConflictError, loadLatestGoal } from '../../v4/plan-store'
import { goalSchedule } from '../goal-schedule'
import type { GoalBudget } from '../goal-budget'
import type { GoalPlanRow } from '../goal-plan'

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002'
const budget: GoalBudget = { weeklyMinutes: 120, dailyMinutes: null, minutesPerUnit: 10, priorities: [] }
let db: PGlite
const read = (name: string) => fs.readFileSync(path.resolve('../../supabase/migrations', name), 'utf8')
let serial = 10
const key = () => `10000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`

/** Transport boundary only; actual validation, SQL writes, immutable readback and schedule functions run unchanged. */
function transport(database = db): SupabaseClient {
  return {
    from(table: string) {
      const filters: [string, unknown][] = []
      let columns = '*'
      const q = {
        select(c: string) { columns = c; return q },
        eq(k: string, v: unknown) { filters.push([k, v]); return q },
        order() { return q },
        async limit(n: number) {
          try {
            const where = filters.map(([k], i) => `${k} = $${i + 1}`).join(' and ')
            const r = await database.query<Record<string, unknown>>(`select ${columns} from public.${table} where ${where} order by id desc limit ${n}`, filters.map(([, v]) => v))
            return { data: r.rows.map(row => ({ ...row, target_date: row.target_date instanceof Date ? row.target_date.toISOString().slice(0, 10) : row.target_date, created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at })), error: null }
          } catch (e) { return { data: null, error: e } }
        },
      }
      return q
    },
    async rpc(name: string, p: Record<string, unknown>) {
      try {
        const b = name === 'csat_map_goal_budget_set'
        const result = await database.query<{ id: number }>(`select public.${name}($1::uuid,$2::smallint,$3::smallint,$4::text,$5::date,$6::uuid${b ? ',$7::jsonb,$8::bigint' : ''}) id`, [p.p_user, p.p_score, p.p_grade, p.p_exam, p.p_date, p.p_client_key, ...(b ? [JSON.stringify(p.p_budget), p.p_expected_goal] : [])])
        return { data: result.rows[0].id, error: null }
      } catch (e) { return { data: null, error: e } }
    },
  } as unknown as SupabaseClient
}

async function bootstrap(database: PGlite) {
  await database.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.csat_map_goal(user_id uuid primary key references auth.users(id),target_score smallint not null,updated_at timestamptz not null default now());
    insert into auth.users values ('${A}'),('${B}');`)
  await database.exec(read('20261010180218_map_v4_plan.sql'))
}
beforeAll(async () => {
  db = new PGlite()
  await bootstrap(db)
  await db.exec(read('20261023090000_csat_goal_budget.sql'))
}, 40000)
afterAll(async () => { await db?.close() })

describe('budget goal: actual versioned SQL and server write', () => {
  it('legacy schema remains readable/writable; missing budget RPC cannot partially save a goal', async () => {
    const legacy = new PGlite()
    try {
      await bootstrap(legacy)
      const client = transport(legacy), now = new Date('2026-10-23T00:00:00Z')
      await setGoal(client, A, { target: 80, clientKey: key() }, now)
      expect((await loadLatestGoal(client, A))?.score).toBe(80)
      await expect(setGoal(client, A, { target: 90, exam: 'suneung', date: '2026-11-19', budget, expectedGoalVersion: (await loadLatestGoal(client, A))!.id, clientKey: key() }, now)).rejects.toBeInstanceOf(GoalBudgetUnavailableError)
      expect((await loadLatestGoal(client, A))?.score).toBe(80)
      expect((await legacy.query('select id from csat_map_goal_version')).rows).toHaveLength(1)
    } finally { await legacy.close() }
  })
  it('A: persists exact inputs, replays without a duplicate, and keeps old goals on time changes', async () => {
    const clientKey = key(), now = new Date('2026-10-23T00:00:00Z')
    const body = { target: 80, exam: 'suneung', date: '2026-11-19', budget, expectedGoalVersion: null, clientKey }
    const first = await setGoal(transport(), A, body, now)
    const replay = await setGoal(transport(), A, body, now)
    expect(replay.goalVersionId).toBe(first.goalVersionId)
    expect(replay.budget).toEqual(budget)
    const next = await setGoal(transport(), A, { ...body, expectedGoalVersion: first.goalVersionId, budget: { ...budget, weeklyMinutes: 30 }, clientKey: key() }, now)
    await expect(setGoal(transport(), A, { ...body, expectedGoalVersion: first.goalVersionId, clientKey: key() }, now)).rejects.toBeInstanceOf(GoalVersionConflictError)
    expect(next.goalVersionId).not.toBe(first.goalVersionId)
    expect((await loadLatestGoal(transport(), A))?.budget?.weeklyMinutes).toBe(30)
    expect((await db.query<{ planning_budget: GoalBudget }>('select planning_budget from csat_map_goal_version where id=$1', [first.goalVersionId])).rows[0].planning_budget).toEqual(budget)
    await expect(setGoal(transport(), A, { ...body, budget: { ...budget, weeklyMinutes: 60 } }, now)).rejects.toBeInstanceOf(GoalConflictError)
  })
  it('B: no exam record is required to store a goal; calendar still blocks missing content and unconfirmed PLAN', async () => {
    await setGoal(transport(), B, { target: 90, exam: 'kice6', date: '2026-11-19', budget, expectedGoalVersion: null, clientKey: key() }, new Date('2026-10-23T00:00:00Z'))
    const goal = await loadLatestGoal(transport(), B)
    const r = { task: 'r.central_meaning', needRank: 1, need: 'CONFIRM', evidence: 'unmeasured', stage: 'check', workspace: 'ws.central-meaning', quantity: { unit: '문항', planned: 2, remaining: 2, done: 0, source: 'proposed' }, action: null, planGate: 'plan', blocked: null, unresolved: [] } as unknown as GoalPlanRow
    expect(goalSchedule(goal, [r], '2026-10-23')).toMatchObject({ allocations: [], unassigned: [{ task: r.task, reason: 'plan', amount: 2, unit: '문항' }] })
  })
  it('C: latest changes do not let an old-key retry reset history; append-only guards hold', async () => {
    const body = { target: 70, exam: 'suneung', date: '2026-11-19', budget, expectedGoalVersion: (await loadLatestGoal(transport(), A))!.id, clientKey: key() }
    const one = await setGoal(transport(), A, body, new Date('2026-10-23T00:00:00Z'))
    const two = await setGoal(transport(), A, { ...body, target: 90, expectedGoalVersion: one.goalVersionId, clientKey: key() }, new Date('2026-10-23T00:00:00Z'))
    expect((await setGoal(transport(), A, body, new Date('2026-11-20T00:00:00Z'))).goalVersionId).toBe(one.goalVersionId)
    expect((await loadLatestGoal(transport(), A))?.id).toBe(two.goalVersionId)
    await expect(db.query('update csat_map_goal_version set planning_budget=null where id=$1', [one.goalVersionId])).rejects.toThrow()
  })
  it('rejects malformed budgets atomically without resetting the latest score', async () => {
    const before = (await db.query('select target_score from csat_map_goal where user_id=$1', [A])).rows
    for (const bad of [{ ...budget, weeklyMinutes: 0 }, { ...budget, dailyMinutes: [100, 100, 0, 0, 0, 0, 0] }, { ...budget, priorities: ['a', 'a'] }]) {
      await expect(db.query('select csat_map_goal_budget_set($1,99::smallint,null,\'suneung\',\'2026-11-19\',$2,$3::jsonb)', [A, key(), JSON.stringify(bad)])).rejects.toThrow('goal_budget_invalid')
    }
    expect((await db.query('select target_score from csat_map_goal where user_id=$1', [A])).rows).toEqual(before)
  })
  it('RLS limits reads to self and authenticated cannot call the writer', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${A}';`)
    try {
      expect((await db.query<{ user_id: string }>('select user_id from csat_map_goal_version')).rows.every(r => r.user_id === A)).toBe(true)
      await expect(db.query('select csat_map_goal_budget_set($1,80::smallint,null,\'suneung\',\'2026-11-19\',$2,$3::jsonb)', [B, key(), JSON.stringify(budget)])).rejects.toThrow('permission denied')
    } finally { await db.exec('reset role;') }
  })
})
