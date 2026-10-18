// apps/web/src/lib/csat/map/v62/__tests__/fi-001-provenance.pglite.test.ts
// FI-001(#293) 회귀 — Codex 최초 반례(probe-delivery-provenance.ts)와 같은 다중 Workspace 사례를 실제 SQL(DB-1 → I2 → G2) +
// 실제 앱 결속(bindDeliveryAttempt)으로 재현한다. 수정 전: 출처 없이 최신 납품(B)을 골라 B 에 영구 결속. 수정 후: 출처 없으면 결속 없음,
// 명시 출처면 그 납품(A)에만, 역할이 안 맞는 명시 출처는 결속 거절(기록 보존 → 올바른 납품으로 복구 가능). 개발 DB 무관(PGlite).
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import { bindDeliveryAttempt } from '../delivery-binding'
import { canonicalDemand } from '../persist-contract'
import { FakeClient } from '../../../authored/__tests__/pglite-supabase'
import { AXES, B_SQL, C_SQL, STUB, as, revOf } from './supply-sql-harness'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8')
const UID = '00000000-0000-4000-8000-0000000000b1'
const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const REF = 'PROVENANCE#1'
const TASK = 'r.central_meaning'
const ANN = 'c'.repeat(64)
const AREF = 'claim-support-provenance.v1'

let db: PGlite
let seq = 0
const key = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`
const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!
const learner = () => new FakeClient(db, UID) as unknown as SupabaseClient

async function deliver(role: string): Promise<{ id: string; ws: string }> {
  const ws = (await one<{ id: string }>(`insert into learner_workspace (user_id) values ($1) returning id`, [UID])).id
  await db.query(`insert into learner_workspace_plan (workspace_id,user_id,plan_version) values ($1,$2,1)`, [ws, UID])
  await as(db, UID)
  const demand = { key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `fi001-${++seq}`, asOf: '2026-10-18T00:00:00Z', core: TASK, support: [],
    purpose: { need: null, evidence: 'fi001', independentItems: null, unknowns: [] }, lines: [{ role, task: TASK, quantity: { n: 1 }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' }] }
  const dem = (await one<{ id: string }>(`select workspace_demand_record($1) id`, [canonicalDemand(UID, demand as never)])).id
  const line = (await one<{ id: string }>(`select id from workspace_content_demand_line where demand_id=$1`, [dem])).id
  const rev = await revOf(db, 'csat_item', REF)
  await as(db, ADMIN)
  const q = (await one<{ id: string }>(`select content_qualification_record('FQ1.1','csat_item',$1,$2,$3,$4,$5::jsonb,'src',$6,null,'gold',$6,$7,$8,'{}','{ev}','isolated fixture',null) id`,
    [REF, rev, TASK, role, JSON.stringify(AXES()), 'a'.repeat(64), AREF, ANN])).id
  await one(`select content_release_approve($1,'public') id`, [q])
  const approval = (await one<{ id: string }>(`select content_release_approve($1,'assessment') id`, [q])).id
  await as(db, UID)
  const id = (await one<{ id: string }>(`select workspace_delivery_record($1,null,$2,$3,$4) id`, [line, q, approval, key()])).id
  return { id, ws }
}

/** G2 쓰기 어댑터가 남기는 혼자 확인 시도 한 행(activity=theater · phase=practice · independent) */
async function attempt(phase: 'practice' | 'transfer' = 'practice'): Promise<string> {
  const sid = (await one<{ id: string }>(`insert into learning_sessions (user_id,item_ref,task_key,help_level,revealed_at) values ($1,$2,'claim-support','independent',now()) returning id`, [UID, REF])).id
  const m = key()
  await db.query(`insert into learning_task_attempts (user_id,task_key,item_ref,session_id,phase,activity,help_level,content_hash,response,client_mutation_id)
    values ($1,'claim-support',$2,$3,$4,'theater','independent',$5,$6::jsonb,$7)`, [UID, REF, sid, phase, ANN, JSON.stringify({ annotation: AREF, grade: { isCorrect: true } }), m])
  return m
}
const bindings = async () => (await db.query<{ delivery_id: string; role: string; evidence: boolean }>(`select delivery_id, role, evidence from workspace_delivery_attempt`)).rows

beforeEach(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(`alter table learning_task_attempts add column activity text, add column help_level text, add column content_hash text,
    add column received_at timestamptz default now(), add column client_mutation_id uuid; alter table learning_sessions add column stage text;`)
  await db.exec(C_SQL); await db.exec(B_SQL)
  await db.exec(read('_pending_workspace_supply_i1_safety.sql'))
  await db.exec(read('20261018120000_workspace_supply_c_annotation_binding.sql'))
  await db.exec(read('20261018120100_r5_delivery_g2_binding.sql'))
  await db.query(`insert into auth.users values ($1),($2)`, [UID, ADMIN])
  await db.query(`insert into admins values ($1,'admin')`, [ADMIN])
  await db.query(`insert into csat_items (id,exam_id,no,stem,passage,choices,answer) values ($1,'PROVENANCE',1,'s','An original isolated provenance fixture.','[1,2,3,4,5]',1)`, [REF])
  const rev = await revOf(db, 'csat_item', REF)
  await db.query(`insert into supply_current_annotation values ($1,$2,$3,$4,$5)`, [REF, TASK, rev, AREF, ANN])
}, 90000)

describe('FI-001 — Workspace A(혼자 확인) 다음 B(전이) 납품, A 에서 시작한 혼자 확인', () => {
  it('출처가 없으면 최신(B)을 고르지 않는다 — no_provenance · 결속 0행(기록은 남는다)', async () => {
    await deliver('independent_check'); await deliver('transfer')
    const m = await attempt()
    expect(await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m })).toEqual({ status: 'no_provenance' })
    expect(await bindings()).toEqual([])
    expect((await one<{ n: number }>(`select count(*)::int n from learning_task_attempts where client_mutation_id = $1`, [m])).n).toBe(1)
  })

  it('명시 출처 A → A 에만 결속 · 혼자 확인 근거(evidence=true)', async () => {
    const a = await deliver('independent_check'); await deliver('transfer')
    const r = await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: await attempt(), deliveryId: a.id })
    expect(r).toMatchObject({ status: 'bound', deliveryId: a.id, evidence: true, reason: null })
    expect(await bindings()).toEqual([{ delivery_id: a.id, role: 'independent_check', evidence: true }])
  })

  it('역할이 안 맞는 명시 출처(B 전이)는 결속 거절 → 같은 시도를 A 로 복구', async () => {
    const a = await deliver('independent_check'); const b = await deliver('transfer')
    const m = await attempt()
    expect(await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m, deliveryId: b.id })).toEqual({ status: 'role_mismatch', deliveryId: b.id })
    expect(await bindings()).toEqual([])
    expect(await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m, deliveryId: a.id })).toMatchObject({ status: 'bound', deliveryId: a.id, evidence: true })
  })

  it('재전송은 처음 결속 그대로 — 다른 납품을 지정해도 옮기지 않는다', async () => {
    const a = await deliver('independent_check'); const b = await deliver('transfer')
    const m = await attempt()
    await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m, deliveryId: a.id })
    expect(await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m, deliveryId: b.id })).toMatchObject({ status: 'bound', deliveryId: a.id })
    expect(await bindings()).toHaveLength(1)
  })

  it('잘못된 납품 id(없는 id · 다른 문항)는 invalid_delivery', async () => {
    await deliver('independent_check')
    const m = await attempt()
    expect((await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: m, deliveryId: '00000000-0000-4000-8000-00000000dead' })).status).toBe('invalid_delivery')
    expect(await bindings()).toEqual([])
  })
})

describe('FI-001 — 두 Workspace 모두 혼자 확인(같은 역할)', () => {
  it('출처 A 면 A 의 PLAN 근거 · B 에는 아무것도 남지 않는다', async () => {
    const a = await deliver('independent_check'); const b = await deliver('independent_check')
    const r = await bindDeliveryAttempt(learner(), { userId: UID, itemRef: REF, clientMutationId: await attempt(), deliveryId: a.id })
    expect(r).toMatchObject({ status: 'bound', deliveryId: a.id, evidence: true })
    const rows = await bindings()
    expect(rows.map((x) => x.delivery_id)).toEqual([a.id])
    expect(rows.map((x) => x.delivery_id)).not.toContain(b.id)
    const ws = (await one<{ workspace_id: string }>(`select workspace_id from workspace_delivery_attempt`)).workspace_id
    expect(ws).toBe(a.ws)
  })
})
