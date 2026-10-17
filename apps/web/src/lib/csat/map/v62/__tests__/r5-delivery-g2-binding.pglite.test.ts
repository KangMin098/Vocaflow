// apps/web/src/lib/csat/map/v62/__tests__/r5-delivery-g2-binding.pglite.test.ts
// R5 §6 · §10 — 공급 ↔ G2 시도 결속 보류 SQL(`_pending_r5_delivery_g2_binding.sql`)을 DB-1(C → B → I1-S 세그먼트, 바이트 동일) + I2 주석 결속 위에
// 격리 Postgres(PGlite)로 적용해 규칙과 반례를 확인한다. 개발 DB 무관.
// ⚠️ 한계: PGlite 는 연결이 하나라 진짜 동시 트랜잭션은 없다 — 경합은 「순차 두 번 주장」 + 부분 고유 인덱스 직접 위조로 검증한다.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canonicalDemand } from '../persist-contract'
import { AXES, B_SQL, C_SQL, STUB, as, errorOf, revOf } from './supply-sql-harness'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8')
const S_SQL = read('_pending_workspace_supply_i1_safety.sql')
const I2_SQL = read('_pending_workspace_supply_c_annotation_binding.sql')
const R5_SQL = read('_pending_r5_delivery_g2_binding.sql')
/** 실제 G2 시도 표의 열(20261008160000 · 180000) — 최소 사본에 없는 것만 더한다 */
const G2_COLUMNS = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now();
  alter table public.learning_sessions add column if not exists stage text;`

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
const ANN = 'c'.repeat(64)
const ANN2 = 'd'.repeat(64)
const TASK = 'r.central_meaning'

let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let wsA: string
let wsB: string
const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!

async function lineFor(uid: string, ws: string, role: string, qty = 10): Promise<string> {
  const d = {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `v6.2-${++n}`,
    asOf: '2026-10-17T00:00:00Z', core: TASK, support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [{ role, task: TASK, quantity: { n: qty }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' }],
  } as unknown as WorkspaceDemand
  await as(db, uid)
  const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, d)])).id
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
}

async function qualify(ref: string, role: string, supersedes: string | null = null): Promise<string> {
  const rev = (await revOf(db, 'csat_item', ref))!
  await as(db, ADMIN)
  const id = (await q1<{ id: string }>(
    `select public.content_qualification_record('FQ1.1','csat_item',$1,$2,$3,$4,$5::jsonb,'src',$6,null,'gold',$6,'ann.v1',$7,'{}','{ev}','2인 검수',$8) id`,
    [ref, rev, TASK, role, JSON.stringify(AXES()), 'a'.repeat(64), ANN, supersedes])).id
  await db.query(`insert into public.supply_current_annotation values ($1,$2,$3,'ann.v1',$4)
    on conflict (artifact_ref, task_id) do update set artifact_revision = excluded.artifact_revision, annotation_ref = excluded.annotation_ref, annotation_hash = excluded.annotation_hash`,
  [ref, TASK, rev, ANN])
  return id
}
async function approve(q: string, scope: 'public' | 'assessment') {
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_release_approve($1, $2) id`, [q, scope])).id
}
/** 평가 역할 공급 하나(자격 · public · assessment 승인 · 공급) */
async function delivered(uid: string, ws: string, ref: string, role = 'independent_check') {
  const line = await lineFor(uid, ws, role)
  const q = await qualify(ref, role)
  const pub = await approve(q, 'public')
  const asm = await approve(q, 'assessment')
  await as(db, uid)
  const id = (await q1<{ id: string }>(`select public.workspace_delivery_record($1, null, $2, $3, $4) id`,
    [line, q, ['independent_check', 'transfer', 'delayed_check'].includes(role) ? asm : pub, key()])).id
  return { line, q, pub, asm, delivery: id }
}
/** 서버(G2 쓰기 어댑터)가 남기는 시도 한 행 — 결속은 그 뒤 학습자 RPC */
async function attempt(uid: string, ref: string, o: { activity?: string | null; phase?: string; help?: string | null; hash?: string | null; session?: boolean } = {}) {
  const sid = o.session === false ? null
    : (await q1<{ id: string }>(`insert into public.learning_sessions (user_id, item_ref, task_key, help_level, revealed_at) values ($1,$2,$3,$4, now()) returning id`,
      [uid, ref, TASK, o.help === undefined ? 'independent' : o.help])).id
  return Number((await q1<{ id: string }>(
    `insert into public.learning_task_attempts (user_id, task_key, item_ref, session_id, phase, activity, help_level, content_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [uid, TASK, ref, sid, o.phase ?? 'practice', o.activity === undefined ? 'theater' : o.activity, o.help === undefined ? 'independent' : o.help,
      o.hash === undefined ? ANN : o.hash])).id)
}
async function bind(uid: string, delivery: string, att: number, k = key()) {
  await as(db, uid)
  return (await q1<{ id: string }>(`select public.workspace_delivery_attempt_record($1, $2, $3) id`, [delivery, att, k])).id
}
const row = (id: string) => q1<Record<string, unknown>>(`select * from public.workspace_delivery_attempt where id = $1`, [id])

let legacyCols: string[]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(G2_COLUMNS)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated`)
  await db.exec(C_SQL)
  await db.exec(B_SQL)
  await db.exec(S_SQL)
  await db.exec(I2_SQL)
  legacyCols = (await db.query<{ c: string }>(`select column_name c from information_schema.columns where table_name = 'learning_task_attempts' order by 1`)).rows.map(r => r.c)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  // 레거시 시도(공급 없음) — 결속 SQL 적용 전부터 있던 행
  await db.exec(`insert into public.csat_items values ('L#1','L',1,'s','Legacy passage.','[1]',1);
    insert into public.learning_task_attempts (user_id, task_key, item_ref, phase) values ('${A}', '${TASK}', 'L#1', 'practice');`)
  await db.exec(R5_SQL)
  await db.exec(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values
    ('R5#1','R5',1,'s','Passage one.','[1,2,3,4,5]',1), ('R5#2','R5',2,'s','Passage two.','[1,2,3,4,5]',2),
    ('R5#3','R5',3,'s','Passage three.','[1,2,3,4,5]',3), ('R5#4','R5',4,'s','Passage four.','[1,2,3,4,5]',4),
    ('R5#5','R5',5,'s','Passage five.','[1,2,3,4,5]',5), ('R5#6','R5',6,'s','Passage six.','[1,2,3,4,5]',1),
    ('R5#7','R5',7,'s','Passage seven.','[1,2,3,4,5]',2), ('R5#8','R5',8,'s','Passage eight.','[1,2,3,4,5]',3),
    ('R5#9','R5',9,'s','Passage nine.','[1,2,3,4,5]',4), ('R5#10','R5',10,'s','Passage ten.','[1,2,3,4,5]',5),
    ('R5#11','R5',11,'s','Passage eleven.','[1,2,3,4,5]',1), ('R5#12','R5',12,'s','Passage twelve.','[1,2,3,4,5]',2),
    ('S#41','S',41,'s','Shared   Long Passage.','[1,2,3,4,5]',1), ('S#42','S',42,'s','shared long passage.','[1,2,3,4,5]',2),
    ('B#1','B',1,'s','Learner B passage.','[1,2,3,4,5]',1), ('R5#13','R5',13,'s','Passage thirteen.','[1,2,3,4,5]',3);`)
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  wsB = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [B])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1), ($3, $4, 1)`, [wsA, A, wsB, B])
}, 60000)

describe('전제 · 기존 표 무변경', () => {
  it('DB-1 세그먼트 = 이 시험이 적용한 보류 파일(바이트 sha256 동일)', () => {
    const sha = (s: string) => createHash('sha256').update(fs.readFileSync(path.join(MIG, s))).digest('hex')
    expect(sha('_pending_workspace_supply_c_qualification.sql')).toBe('dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66')
    expect(sha('_pending_workspace_supply_b_orders.sql')).toBe('2957ecf73c4399f81971581769021b30eb69c1141c29a443de62a5aa4506aa02')
    expect(sha('_pending_workspace_supply_i1_safety.sql')).toBe('cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de')
  })

  it('DB-1 이 없으면 / I2 가 없으면 적용 전에 멈춘다', async () => {
    const bare = new PGlite()
    await bare.exec(STUB)
    expect(await errorOf(bare.exec(R5_SQL))).toMatch(/requires DB-1 first/)
    await bare.exec(I1_STUB); await bare.exec(G2_COLUMNS); await bare.exec(C_SQL); await bare.exec(B_SQL); await bare.exec(S_SQL)
    expect(await errorOf(bare.exec(R5_SQL))).toMatch(/requires DB-1 \+ I2/)
    await bare.exec(I2_SQL)
    expect(await errorOf(bare.exec(R5_SQL))).toBeNull()
    expect(await errorOf(bare.exec(R5_SQL))).toMatch(/already exists/)
    await bare.close()
  }, 60000)

  it('learning_task_attempts 열은 그대로 · 레거시 시도는 결속 없이 남는다(백필 0)', async () => {
    const after = (await db.query<{ c: string }>(`select column_name c from information_schema.columns where table_name = 'learning_task_attempts' order by 1`)).rows.map(r => r.c)
    expect(after).toEqual(legacyCols)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.learning_task_attempts where item_ref = 'L#1'`)).n).toBe(1)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_delivery_attempt where artifact_ref = 'L#1'`)).n).toBe(0)
  })

  it('정의자 함수 search_path 고정 · 학습자는 SELECT 만 · 실행권 최소', async () => {
    const r = await db.query<{ proname: string; cfg: string[]; def: boolean }>(
      `select proname, proconfig cfg, prosecdef def from pg_proc where proname in ('workspace_delivery_attempt_record','r5_exposure_key')`)
    for (const p of r.rows) { expect(p.def).toBe(true); expect(p.cfg).toContain('search_path=public, pg_temp') }
    const priv = await q1<Record<string, boolean>>(`select
      has_function_privilege('anon','public.workspace_delivery_attempt_record(uuid,bigint,uuid)','execute') anon_rpc,
      has_function_privilege('authenticated','public.workspace_delivery_attempt_record(uuid,bigint,uuid)','execute') auth_rpc,
      has_function_privilege('authenticated','public.r5_exposure_key(text,text)','execute') auth_key,
      has_table_privilege('authenticated','public.workspace_delivery_attempt','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') auth_write,
      has_table_privilege('authenticated','public.workspace_delivery_attempt','SELECT') auth_read,
      has_table_privilege('anon','public.workspace_delivery_attempt','SELECT') anon_read`)
    expect(priv).toEqual({ anon_rpc: false, auth_rpc: true, auth_key: false, auth_write: false, auth_read: true, anon_read: false })
  })
})

describe('결속 — 정상 경로와 기록 내용', () => {
  it('독립 확인 공급 → 첫 독립 시도 = 근거 · 모든 결속 열이 남는다', async () => {
    const d = await delivered(A, wsA, 'R5#1')
    const att = await attempt(A, 'R5#1')
    const r = await row(await bind(A, d.delivery, att))
    expect(r).toMatchObject({ user_id: A, workspace_id: wsA, plan_version: 1, line_id: d.line, order_id: null, delivery_id: d.delivery,
      qualification_id: d.q, approval_id: d.asm, artifact_ref: 'R5#1', task_id: TASK, role: 'independent_check',
      annotation_ref: 'ann.v1', annotation_hash: ANN, help_state: 'independent', first_exposure: true, evidence: true, non_evidence_reason: null })
    expect(r.first_exposed_at).not.toBeNull()
    expect(r.artifact_revision).toBe(await revOf(db, 'csat_item', 'R5#1'))
  })

  it('전이 공급 + theater/transfer 시도 = 근거 · 도움 받은 시도 = 비근거(help_state_mismatch)', async () => {
    const t = await delivered(A, wsA, 'R5#2', 'transfer')
    expect(await row(await bind(A, t.delivery, await attempt(A, 'R5#2', { phase: 'transfer' })))).toMatchObject({ help_state: 'transfer', evidence: true })
    const h = await delivered(A, wsA, 'R5#3')
    expect(await row(await bind(A, h.delivery, await attempt(A, 'R5#3', { help: 'hint' }))))
      .toMatchObject({ help_state: 'helped', first_exposure: true, evidence: false, non_evidence_reason: 'help_state_mismatch' })
  })

  it('연습(activity=practice) 시도 = practice · 비근거', async () => {
    const d = await delivered(A, wsA, 'R5#4')
    expect(await row(await bind(A, d.delivery, await attempt(A, 'R5#4', { activity: 'practice' }))))
      .toMatchObject({ help_state: 'practice', evidence: false, non_evidence_reason: 'help_state_mismatch' })
  })

  it('세션 · 내용 hash · activity 가 빠진 시도는 결속 거절(unbound)', async () => {
    const d = await delivered(A, wsA, 'R5#5')
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#5', { session: false })))).toMatch(/unbound/)
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#5', { activity: null })))).toMatch(/unbound/)
  })
})

describe('반례', () => {
  it('다른 학습자: 남의 공급 · 남의 시도는 42501', async () => {
    const d = await delivered(A, wsA, 'R5#6')
    const attA = await attempt(A, 'R5#6')
    expect(await errorOf(bind(B, d.delivery, attA))).toMatch(/delivery not found or not owned/)
    const b = await delivered(B, wsB, 'B#1')
    expect(await errorOf(bind(B, b.delivery, attA))).toMatch(/attempt not found or not owned/)
    expect(await errorOf(bind(A, b.delivery, attA))).toMatch(/delivery not found or not owned/)
  })

  it('다른 문항의 시도 · 공급 전에 받은 시도는 거절', async () => {
    const d = await delivered(A, wsA, 'R5#7')
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#1')))).toMatch(/item\/task differs/)
    const early = await attempt(A, 'R5#7')
    await db.query(`update public.learning_task_attempts set received_at = now() - interval '1 day' where id = $1`, [early])
    expect(await errorOf(bind(A, d.delivery, early))).toMatch(/predates delivery/)
  })

  it('중복: 같은 요청 키 + 같은 본문 = 같은 id · 다른 본문 = 23505 · 같은 시도 두 번 결속 거절', async () => {
    const d = await delivered(A, wsA, 'R5#8')
    const a1 = await attempt(A, 'R5#8')
    const k = key()
    const id = await bind(A, d.delivery, a1, k)
    expect(await bind(A, d.delivery, a1, k)).toBe(id)
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#8'), k))).toMatch(/request_key reused/)
    expect(await errorOf(bind(A, d.delivery, a1))).toMatch(/already bound/)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_delivery_attempt where attempt_id = $1`, [a1])).n).toBe(1)
  })

  it('경합(순차 두 주장): 같은 문항 두 번째 독립 시도는 첫 노출이 아니다 → 비근거', async () => {
    const d = await delivered(A, wsA, 'R5#9')
    const first = await row(await bind(A, d.delivery, await attempt(A, 'R5#9')))
    const second = await row(await bind(A, d.delivery, await attempt(A, 'R5#9')))
    expect(first).toMatchObject({ first_exposure: true, evidence: true })
    expect(second).toMatchObject({ first_exposure: false, first_exposed_at: null, evidence: false, non_evidence_reason: 'not_first_exposure' })
  })

  it('경합: 결속 전에 이미 받은 두 시도 — 두 번째 시도를 먼저 결속해도 앞선 G2 시도가 있어 첫 노출이 아니다', async () => {
    const d = await delivered(A, wsA, 'R5#13')
    const a1 = await attempt(A, 'R5#13')
    const a2 = await attempt(A, 'R5#13')
    expect(await row(await bind(A, d.delivery, a2))).toMatchObject({ first_exposure: false, non_evidence_reason: 'not_first_exposure' })
    expect(await row(await bind(A, d.delivery, a1))).toMatchObject({ first_exposure: false })
  })

  it('정규화 동일 지문: 다른 문항이라도 같은 지문의 두 번째 공급 시도는 첫 노출이 아니다', async () => {
    const d1 = await delivered(A, wsA, 'S#41')
    const d2 = await delivered(A, wsA, 'S#42')
    expect(await row(await bind(A, d1.delivery, await attempt(A, 'S#41')))).toMatchObject({ first_exposure: true, evidence: true })
    expect(await row(await bind(A, d2.delivery, await attempt(A, 'S#42')))).toMatchObject({ first_exposure: false, evidence: false })
  })

  it('최종 방어선: 같은 사용자 × 노출 키로 두 번째 first_exposure 행은 고유 인덱스가 거절한다', async () => {
    const r = await q1<Record<string, unknown>>(`select * from public.workspace_delivery_attempt where artifact_ref = 'R5#9' and first_exposure`)
    const forged = await attempt(A, 'R5#9')
    await as(db, null)
    const err = await errorOf(db.exec(`begin; select set_config('vocaflow.supply_writer','rpc',true);
      insert into public.workspace_delivery_attempt (user_id, workspace_id, plan_version, demand_id, line_id, delivery_id, qualification_id, approval_id,
        artifact_kind, artifact_ref, task_id, role, artifact_revision, annotation_ref, annotation_hash, attempt_id, session_id, help_state, exposure_key,
        first_exposure, first_exposed_at, evidence, request_key)
      select user_id, workspace_id, plan_version, demand_id, line_id, delivery_id, qualification_id, approval_id, artifact_kind, artifact_ref, task_id, role,
        artifact_revision, annotation_ref, annotation_hash, ${forged}, session_id, help_state, exposure_key, true, now(), true, '${key()}'
      from public.workspace_delivery_attempt where id = '${r.id}'; commit;`))
    await db.exec('rollback').catch(() => undefined)
    expect(err).toMatch(/workspace_delivery_attempt_first_exposure/)
  })

  it('승인 철회 뒤 시도 = 비근거(approval_revoked) · 앞선 근거 행은 그대로', async () => {
    const d = await delivered(A, wsA, 'R5#10')
    const before = await bind(A, d.delivery, await attempt(A, 'R5#10'))
    await as(db, ADMIN)
    await db.query(`select public.content_release_revoke($1, 'rights withdrawn')`, [d.asm])
    const after = await row(await bind(A, d.delivery, await attempt(A, 'R5#10')))
    expect(after).toMatchObject({ evidence: false, non_evidence_reason: 'approval_revoked' })
    expect(await row(before)).toMatchObject({ evidence: true, non_evidence_reason: null })
  })

  it('자격 대체 뒤 시도 = 비근거(qualification_superseded)', async () => {
    const d = await delivered(A, wsA, 'R5#11')
    await qualify('R5#11', 'independent_check', d.q)
    expect(await row(await bind(A, d.delivery, await attempt(A, 'R5#11'))))
      .toMatchObject({ evidence: false, non_evidence_reason: 'qualification_superseded' })
  })

  it('revision · 주석이 공급과 다르면 결속 거절(시도 hash · 현재 배포 주석 · 문항 본문)', async () => {
    const d = await delivered(A, wsA, 'R5#12')
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#12', { hash: ANN2 })))).toMatch(/attempt annotation differs/)
    await db.query(`update public.supply_current_annotation set annotation_hash = $1 where artifact_ref = 'R5#12'`, [ANN2])
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#12')))).toMatch(/current annotation differs/)
    await db.query(`update public.supply_current_annotation set annotation_hash = $1 where artifact_ref = 'R5#12'`, [ANN])
    await db.exec(`update public.csat_items set stem = 'changed' where id = 'R5#12'`)
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'R5#12')))).toMatch(/revision changed since delivery/)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_delivery_attempt where artifact_ref = 'R5#12'`)).n).toBe(0)
  })

  it('Workspace 가 active 가 아니면 결속 거절', async () => {
    const ws = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
    await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [ws, A])
    await db.exec(`insert into public.csat_items values ('P#1','P',1,'s','Paused passage.','[1]',1)`)
    const d = await delivered(A, ws, 'P#1')
    await db.query(`update public.learner_workspace set status = 'paused' where id = $1`, [ws])
    expect(await errorOf(bind(A, d.delivery, await attempt(A, 'P#1')))).toMatch(/workspace not active/)
  })
})

describe('직접 쓰기 · RLS', () => {
  it('학습자 역할은 표에 직접 쓰지 못하고 자기 행만 읽는다', async () => {
    await as(db, A)
    await db.exec('set role authenticated')
    try {
      expect(await errorOf(db.exec(`insert into public.workspace_delivery_attempt (user_id) values ('${A}')`))).toMatch(/permission denied/)
      expect(await errorOf(db.exec(`update public.workspace_delivery_attempt set evidence = true`))).toMatch(/permission denied/)
      expect(await errorOf(db.exec(`delete from public.workspace_delivery_attempt`))).toMatch(/permission denied/)
      const mine = await q1<{ n: number; other: number }>(`select count(*)::int n, count(*) filter (where user_id <> '${A}')::int other from public.workspace_delivery_attempt`)
      expect(mine.n).toBeGreaterThan(0)
      expect(mine.other).toBe(0)
    } finally { await db.exec('reset role') }
  })

  it('소유자(서비스 키 포함)도 RPC 밖 INSERT · UPDATE · DELETE 는 가드가 거절(추가 전용)', async () => {
    await as(db, null)
    expect(await errorOf(db.exec(`insert into public.workspace_delivery_attempt (user_id) values ('${A}')`))).not.toBeNull()
    expect(await errorOf(db.exec(`update public.workspace_delivery_attempt set evidence = false`))).toMatch(/append-only/)
    expect(await errorOf(db.exec(`delete from public.workspace_delivery_attempt`))).toMatch(/append-only/)
  })

  it('로그인 없으면 Forbidden', async () => {
    await as(db, null)
    expect(await errorOf(db.query(`select public.workspace_delivery_attempt_record($1, 1, $2)`, [key(), key()]))).toMatch(/Forbidden/)
  })
})
