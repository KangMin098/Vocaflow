// apps/web/src/lib/csat/map/v62/__tests__/final-assessment.pglite.test.ts
// Real goal SQL (map_v4_plan + budget + PT409 patch) + proposed final-assessment SQL in disposable memory. No shared DB writes.
// Single connection: not a concurrency proof. The actual server bind/readback and the attainment projection run unchanged.
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setGoal } from '../../server'
import { GoalVersionConflictError, loadLatestGoal } from '../../v4/plan-store'
import { finalAttainment } from '../final-assessment'
import { FinalAssessmentConflictError, FinalAssessmentInputError, FinalAssessmentUnavailableError, bindFinalAssessment, loadFinalAssessment } from '../final-assessment-store'
import type { OutcomeSession } from '../goal-outcome'

const A = '20000000-0000-4000-8000-000000000001', B = '20000000-0000-4000-8000-000000000002'
const read = (name: string) => fs.readFileSync(path.resolve('../../supabase/migrations', name), 'utf8')
let serial = 100
const key = () => `20000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`
const NOW = new Date('2026-10-23T03:00:00Z')

const iso = (v: unknown) => v instanceof Date ? v.toISOString() : v
/** Transport boundary only (PostgREST shape). Errors keep the SQLSTATE in `code` like PostgREST. */
function transport(database: PGlite): SupabaseClient {
  const err = (e: unknown) => ({ code: (e as { code?: string }).code, message: (e as Error).message })
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
            return { data: r.rows.map(row => ({ ...row, target_date: row.target_date instanceof Date ? row.target_date.toISOString().slice(0, 10) : row.target_date, assessment_date: row.assessment_date instanceof Date ? row.assessment_date.toISOString().slice(0, 10) : row.assessment_date, created_at: iso(row.created_at) })), error: null }
          } catch (e) { return { data: null, error: err(e) } }
        },
      }
      return q
    },
    async rpc(name: string, p: Record<string, unknown>) {
      try {
        if (name === 'csat_map_goal_final_assessment_bind') {
          const r = await database.query<{ id: number }>('select public.csat_map_goal_final_assessment_bind($1::uuid,$2::bigint,$3::date,$4::uuid) id', [p.p_user, p.p_goal, p.p_date, p.p_client_key])
          return { data: r.rows[0].id, error: null }
        }
        const b = name === 'csat_map_goal_budget_set'
        const r = await database.query<{ id: number }>(`select public.${name}($1::uuid,$2::smallint,$3::smallint,$4::text,$5::date,$6::uuid${b ? ',$7::jsonb,$8::bigint' : ''}) id`, [p.p_user, p.p_score, p.p_grade, p.p_exam, p.p_date, p.p_client_key, ...(b ? [p.p_budget == null ? null : JSON.stringify(p.p_budget), p.p_expected_goal] : [])])
        return { data: r.rows[0].id, error: null }
      } catch (e) { return { data: null, error: err(e) } }
    },
  } as unknown as SupabaseClient
}

async function bootstrap(database: PGlite) {
  await database.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant usage on schema public to authenticated, anon, service_role;
    create table public.csat_map_goal(user_id uuid primary key references auth.users(id),target_score smallint not null,updated_at timestamptz not null default now());
    insert into auth.users values ('${A}'),('${B}');`)
  await database.exec(read('20261010180218_map_v4_plan.sql'))
  await database.exec(read('20261023043453_csat_goal_budget.sql'))
  await database.exec(read('20261023061401_csat_goal_budget_conflict.sql'))
}

let db: PGlite
let api: SupabaseClient
beforeAll(async () => {
  db = new PGlite()
  await bootstrap(db)
  api = transport(db)
}, 40000)
afterAll(async () => { await db?.close() })

const goalBody = (over: Record<string, unknown> = {}) => ({ target: 85, grade: 2, exam: 'suneung', date: '2026-11-19', clientKey: key(), ...over })
// Goals created "today" (DB now()) — window min is tomorrow in Seoul.
const seoulTomorrow = () => new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10)

describe('final assessment — before installation', () => {
  it('missing table/RPC = not installed: read stays distinct from unbound and a bind is never acknowledged', async () => {
    await setGoal(api, A, goalBody({ date: '2030-11-14' }), new Date())
    const g = (await loadLatestGoal(api, A))!
    expect(await loadFinalAssessment(api, A, g.id)).toEqual({ status: 'not_installed' })
    await expect(bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-14', clientKey: key() })).rejects.toBeInstanceOf(FinalAssessmentUnavailableError)
  })
})

describe('final assessment — proposed SQL installed', () => {
  beforeAll(async () => { await db.exec(read('20261023082930_csat_goal_final_assessment.sql')) })

  it('binds once to the latest goal version, replays the same key, refuses a different body for that key', async () => {
    const g = (await loadLatestGoal(api, A))!
    const k = key()
    const first = await bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-14', clientKey: k })
    expect(first).toMatchObject({ reused: false, binding: { goalVersionId: g.id, date: '2030-11-14' } })
    expect(await bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-14', clientKey: k })).toMatchObject({ reused: true, binding: { id: first.binding.id } })
    await expect(bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-13', clientKey: k })).rejects.toBeInstanceOf(FinalAssessmentConflictError)
    // A second binding for the same goal version is a non-retryable conflict.
    await expect(bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-13', clientKey: key() })).rejects.toBeInstanceOf(FinalAssessmentConflictError)
    expect(await loadFinalAssessment(api, A, g.id)).toMatchObject({ status: 'ok', binding: { date: '2030-11-14' } })
  })

  it('a new goal version starts unbound; binding the old version is goal_changed (app and SQL)', async () => {
    const old = (await loadLatestGoal(api, A))!
    await setGoal(api, A, goalBody({ date: '2030-11-14', expectedGoalVersion: old.id, budget: { weeklyMinutes: 120, dailyMinutes: null, minutesPerUnit: 10, priorities: [] } }), new Date())
    const g = (await loadLatestGoal(api, A))!
    expect(g.id).not.toBe(old.id)
    expect(await loadFinalAssessment(api, A, g.id)).toEqual({ status: 'ok', binding: null })
    await expect(bindFinalAssessment(api, A, { goalVersionId: old.id, date: '2030-11-14', clientKey: key() })).rejects.toBeInstanceOf(GoalVersionConflictError)
    await expect(db.query('select public.csat_map_goal_final_assessment_bind($1,$2,$3,$4)', [A, old.id, '2030-11-14', key()])).rejects.toMatchObject({ code: 'PT409', message: 'goal_changed' })
  })

  it('window: after the goal day (Seoul) up to the goal date — enforced by the SQL writer too', async () => {
    const g = (await loadLatestGoal(api, A))!
    await expect(bindFinalAssessment(api, A, { goalVersionId: g.id, date: '2030-11-15', clientKey: key() })).rejects.toBeInstanceOf(FinalAssessmentInputError)
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    await expect(db.query('select public.csat_map_goal_final_assessment_bind($1,$2,$3,$4)', [A, g.id, today, key()])).rejects.toMatchObject({ code: '22023' })
    await expect(db.query('select public.csat_map_goal_final_assessment_bind($1,$2,$3,$4)', [A, g.id, '2030-11-15', key()])).rejects.toMatchObject({ code: '22023' })
    expect((await bindFinalAssessment(api, A, { goalVersionId: g.id, date: seoulTomorrow(), clientKey: key() })).binding.date).toBe(seoulTomorrow())
  })

  it('a goal without exam/date cannot bind', async () => {
    await setGoal(api, B, { target: 70, clientKey: key() }, NOW)
    const g = (await loadLatestGoal(api, B))!
    await expect(bindFinalAssessment(api, B, { goalVersionId: g.id, date: seoulTomorrow(), clientKey: key() })).rejects.toBeInstanceOf(FinalAssessmentInputError)
    await expect(db.query('select public.csat_map_goal_final_assessment_bind($1,$2,$3,$4)', [B, g.id, seoulTomorrow(), key()])).rejects.toMatchObject({ code: '22023' })
  })

  it('another learner cannot bind or read A’s goal version', async () => {
    const g = (await loadLatestGoal(api, A))!
    await expect(db.query('select public.csat_map_goal_final_assessment_bind($1,$2,$3,$4)', [B, g.id, seoulTomorrow(), key()])).rejects.toMatchObject({ code: 'PT409' })
    expect(await loadFinalAssessment(api, B, g.id)).toEqual({ status: 'ok', binding: null })
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${B}', false);`)
    try {
      expect((await db.query('select count(*)::int n from public.csat_map_goal_final_assessment')).rows[0]).toEqual({ n: 0 })
    } finally { await db.exec('reset role;') }
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`)
    try {
      expect(((await db.query<{ n: number }>('select count(*)::int n from public.csat_map_goal_final_assessment')).rows[0]).n).toBeGreaterThan(0)
    } finally { await db.exec('reset role;') }
  })

  it('append-only and service-role-only writer', async () => {
    await expect(db.exec('update public.csat_map_goal_final_assessment set assessment_date = assessment_date')).rejects.toThrow()
    await expect(db.exec('delete from public.csat_map_goal_final_assessment')).rejects.toThrow()
    const acl = await db.query<{ anon: boolean; auth: boolean; svc: boolean; ins: boolean }>(`select
      has_function_privilege('anon','public.csat_map_goal_final_assessment_bind(uuid,bigint,date,uuid)','execute') anon,
      has_function_privilege('authenticated','public.csat_map_goal_final_assessment_bind(uuid,bigint,date,uuid)','execute') auth,
      has_function_privilege('service_role','public.csat_map_goal_final_assessment_bind(uuid,bigint,date,uuid)','execute') svc,
      has_table_privilege('authenticated','public.csat_map_goal_final_assessment','insert') ins`)
    expect(acl.rows[0]).toEqual({ anon: false, auth: false, svc: true, ins: false })
  })

  it('end to end: the stored binding drives final attainment from the bound date’s record only', async () => {
    const g = (await loadLatestGoal(api, A))!
    const read = await loadFinalAssessment(api, A, g.id)
    expect(read.status).toBe('ok')
    const date = seoulTomorrow()
    const s = (id: string, takenAt: string, raw: number, over: Partial<OutcomeSession> = {}): OutcomeSession =>
      ({ id, examId: `ex-${id}`, examLabel: id, takenAt, enteredAt: `${takenAt}T12:00:00Z`, raw, grade: 2, diagnosable: true, examReady: true, mode: 'live', firstExposure: 'unseen', examScope: 'suneung', ...over })
    const later = new Date(Date.parse(`${date}T00:00:00Z`) + 3 * 86400000).toISOString()
    expect(finalAttainment(g, read, [], [], new Date().toISOString()).status).toBe('scheduled')
    expect(finalAttainment(g, read, [s('x', later.slice(0, 10), 99)], [], later).status).toBe('awaiting_record')
    expect(finalAttainment(g, read, [s('f', date, 88)], [], later).status).toBe('met')
    expect(finalAttainment(g, read, [s('f', date, 70)], [], later).status).toBe('not_met')
  })
})
