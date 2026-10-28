// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-supply.pglite.test.ts
// 1C C3~C5 — 실제 1B core + 실제 SQL(C → B → I1-S → I1-P → I2 → G2 → D3 → _pending_factory_dcp_admission)을 격리 PGlite 에 올려
// 후보 등록 → 자격 → 출시 승인 → 학습자 본인 공급 → 현재 유효성까지 서비스(dcp-supply.ts)로 잇는다. 공유 DB · 환경 키 · 네트워크 없음.
// 대역: auth.uid() 는 하네스의 jwt claim 설정(격리 전용) · 원천 행 · 등록 공장 주문은 시험 DB 에 직접 넣는다(D3 등록 RPC 는 service_role 경계라 범위 밖).
// ⚠️ PGlite 는 슈퍼유저 단일 연결이라 RLS 를 실행하지 않는다 — 권한은 has_*_privilege 와 정의자 함수의 auth 검사로 본다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import { canonicalJson } from '../../canonical-json'
import type { WorkspaceDemand } from '../../demand'
import { canonicalDemand } from '../../persist-contract'
import { B_SQL, C_SQL, STUB, as } from '../../__tests__/supply-sql-harness'
import { planAdmission } from '../dcp-admission'
import { admitCandidates, approveForGuidedPractice, d3Linker, receiveForLearner, type SourceReader, type SupplyClient } from '../dcp-supply'
import type { ProductionOutput, ProductionPacket } from '../local-production'
import { fileSha, outputOf, packetOf, prepared, reviewOf, row, SOURCE_ID } from './dcp-fixture'

const MIG = path.resolve(__dirname, '../../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.resolve(__dirname, '../../__tests__/supply-i1-stub.sql'), 'utf8')
const G2_COLUMNS = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now();
  alter table public.learning_sessions add column if not exists stage text;`
const DCP_COLUMNS = `alter table public.csat_dcp_items alter column id set default gen_random_uuid();
  alter table public.csat_dcp_items add column item_role text not null default 'practice', add column paragraph_idx int not null default 0,
  add constraint csat_dcp_items_slot unique (kind, ref_id, type, paragraph_idx);
  create table public.library_articles (id uuid primary key, content text not null, row jsonb not null);
  create role service_role nologin;`

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let wsA: string
let wsB: string
let packet: ProductionPacket
let output: ProductionOutput
const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!
const count = async (sql: string, p: unknown[] = []) => (await q1<{ n: number }>(`select count(*)::int n from ${sql}`, p)).n

/** supabase-js rpc 모양의 격리 어댑터 — 호출마다 그 세션의 auth.uid 로 실행한다 */
const client = (uid: string | null): SupplyClient => ({
  async rpc<T>(fn: string, args: Record<string, unknown>) {
    await as(db, uid)
    const keys = Object.keys(args)
    const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v })
    // 시험 트랜잭션(begin … rollback) 안에서는 실패한 RPC 만 되돌린다 — supabase-js 의 호출당 트랜잭션과 같은 경계
    const inTx = db.isInTransaction()
    if (inTx) await db.exec('savepoint rpc')
    try {
      const r = await db.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) r`, vals)
      if (inTx) await db.exec('release savepoint rpc')
      return { data: r.rows[0]!.r, error: null }
    } catch (e) {
      if (inTx) await db.exec('rollback to savepoint rpc')
      return { data: null, error: { message: (e as Error).message } }
    }
  },
})
const admin = client(ADMIN)
const reader: SourceReader = async (id) => {
  const r = (await db.query<{ content: string; row: Record<string, unknown> }>(`select content, row from public.library_articles where id = $1`, [id])).rows[0]
  return r ? { snapshot_kind: 'read_only_database_export', current_time: '2026-10-21T07:00:00Z', row: { ...r.row, content: r.content } } : null
}
const RIGHTS = { record_id: 'isolated-rights-fixture#cc0', basis: 'isolated_harness_only' }
const input = (o: { review?: unknown; out?: ProductionOutput; rights?: typeof RIGHTS | null; p?: ProductionPacket } = {}) => {
  const p = o.p ?? packet
  const out = o.out ?? output
  return { packet: p, output: out, outputSha256: fileSha(out), review: o.review ?? reviewOf(p, out), rights: o.rights === undefined ? RIGHTS : o.rights }
}

/** 수요 줄 — 기본은 그 Workspace 의 **최신** plan 판으로 만든다. stale 시험만 plan 을 명시한다. spec 은 등록 제품주문과 같다 */
async function lineFor(uid: string, ws: string, role = 'guided_practice', qty = 10, plan?: number): Promise<string> {
  const planVersion = plan ?? (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [ws])).v
  const spec = packet.body.spec as unknown as { definition: string; types: string[]; keys: string[]; requires: Record<string, unknown> }
  const d = {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion, definitionVersion: spec.definition,
    asOf: '2026-10-21T00:00:00Z', core: 'r.central_meaning', support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [{ role, task: 'r.central_meaning', quantity: { n: qty }, csatTypes: spec.types, taskKeys: spec.keys, requires: spec.requires, reason: `need-${++n}` }],
  } as unknown as WorkspaceDemand
  await as(db, uid)
  const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, d)])).id
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
}
const valid = async (d: string) => { await as(db, ADMIN); return (await q1<{ v: boolean }>(`select public.supply_delivery_valid($1) v`, [d])).v }
/** service_role 경계 대역 — jwt 없음(auth.uid null). D3 RPC 는 p_actor(실제 관리자)를 스스로 검증한다 */
const service = client(null)
const signatureOf = async (order: string) =>
  (await db.query<{ s: string }>(`select d.signature s from public.factory_order o join public.workspace_content_demand_line l on l.id = o.line_id
    join public.workspace_content_demand d on d.id = l.demand_id where o.id = $1`, [order])).rows[0]?.s ?? null
const productOf = (p: ProductionPacket) => ({ product_order_id: p.body.order.product_order_id, order_revision: p.body.order.order_revision, order_hash: p.body.order.order_hash })
const linker = (product = productOf(packet), actor = ADMIN) =>
  d3Linker(service, actor, product, signatureOf, { quantity: 3, reason: '1C 격리 공급', requestKey: () => key() })
const receive = (uid: string, line: string, q: string, approval: string, link = linker()) =>
  receiveForLearner(client(uid), link, { lineId: line, quantity: 3, qualificationId: q, approvalId: approval, orderKey: key(), deliveryKey: key() })

async function registerOrder(p: ProductionPacket) {
  const prep = await prepared()
  const canonical = canonicalJson((prep as unknown as { factory: { order: unknown } }).factory.order)
  const spec = { ...p.body.spec, schema: 'vf.factory-lineage-spec/1' }
  await db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, canonical_order, spec, spec_hash, quantity, reason, registered_by, request_key)
    values ($1, $2, $3, $4, $5::jsonb, encode(sha256(convert_to(public.factory_lineage_canonical($5::jsonb), 'UTF8')), 'hex'), 3, 'isolated 1C', $6, $7)`,
    [p.body.order.product_order_id, p.body.order.order_revision, p.body.order.order_hash, canonical, JSON.stringify(spec), ADMIN, key()])
}

let happy: { items: { dcp_item_id: string; qualification_id: string | null; artifact_revision: string }[]; approval: string; line: string; delivery: string }

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(G2_COLUMNS)
  await db.exec(DCP_COLUMNS)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`)
  for (const s of [C_SQL, B_SQL, read('_pending_workspace_supply_i1_safety.sql'), read('_pending_workspace_supply_i1_partial.sql'),
    read('20261018120000_workspace_supply_c_annotation_binding.sql'), read('20261018120100_r5_delivery_g2_binding.sql'),
    read('20261020063000_factory_product_order_lineage_v1.sql'), read('_pending_factory_dcp_admission.sql')]) await db.exec(s)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  packet = await packetOf(false)
  output = outputOf(packet)
  const src = packet.body.source
  const { content, ...rest } = row()
  await db.query(`insert into public.library_articles (id, content, row) values ($1, $2, $3::jsonb)`, [src.id, content, JSON.stringify(rest)])
  await registerOrder(packet)
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  wsB = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [B])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1), ($3, $4, 1)`, [wsA, A, wsB, B])
}, 120000)

describe('C4 · 정상 경로 — 등록 → 자격 → 승인 → 학습자 공급', () => {
  it('관리자 세션 등록 · AI 검수 기록 · 별도 승인 · 학습자 본인 공급 · 현재 유효', async () => {
    const r = await admitCandidates(admin, reader, input(), { isolated: true })
    if (!r.ok) throw new Error(`${r.code} ${r.detail ?? ''}`)
    expect(r.items).toHaveLength(3)
    expect(r.items.every((i) => i.qualification_id && !i.replayed)).toBe(true)
    const rows = (await db.query<{ type: string; ref_id: string; item_role: string; answer: number }>(
      `select type, ref_id, item_role, (answer_key->>'answer')::int answer from public.csat_dcp_items where id = any($1::uuid[]) order by type`, [r.items.map((i) => i.dcp_item_id)])).rows
    expect(rows).toEqual([
      { type: 'main_point', ref_id: SOURCE_ID, item_role: 'practice', answer: 2 },
      { type: 'title', ref_id: SOURCE_ID, item_role: 'practice', answer: 4 },
      { type: 'topic', ref_id: SOURCE_ID, item_role: 'practice', answer: 1 },
    ])
    expect(await q1(`select review_kind, review_model, role, task_id from public.factory_dcp_admission where dcp_item_id = $1`, [r.items[0]!.dcp_item_id]))
      .toEqual({ review_kind: 'ai', review_model: 'codex', role: 'guided_practice', task_id: 'r.central_meaning' })
    const q = await q1<{ method: string; artifact_kind: string; f: string }>(`select method, artifact_kind, axes->'F'->>'state' f from public.content_qualification where id = $1`, [r.items[0]!.qualification_id])
    expect(q).toMatchObject({ artifact_kind: 'dcp_item', f: 'pass' })
    expect(q.method).toMatch(/AI 검수.*사람 검수 아님/)
    // 등록 · 자격만으로는 승인이 없다
    expect(await count(`public.content_release_approval where qualification_id = $1`, [r.items[0]!.qualification_id])).toBe(0)
    const ap = await approveForGuidedPractice(admin, r.items[0]!.qualification_id!, '1C 격리 — AI 검수 기반 후보')
    if (!ap.ok) throw new Error(ap.code)
    const line = await lineFor(A, wsA)
    const d = await receive(A, line, r.items[0]!.qualification_id!, ap.data)
    if (!d.ok) throw new Error(`${d.code} ${d.detail}`)
    expect(await valid(d.delivery_id)).toBe(true)
    expect(await q1(`select user_id, role, artifact_kind, order_id from public.workspace_content_delivery where id = $1`, [d.delivery_id]))
      .toEqual({ user_id: A, role: 'guided_practice', artifact_kind: 'dcp_item', order_id: d.order_id })
    happy = { items: r.items, approval: ap.data, line, delivery: d.delivery_id }
  })

  it('재요청은 같은 행(멱등 · 같은 기존 자격 id · 자격 행 추가 없음) · 같은 키 다른 본문은 거절 · 같은 자리 새 본문은 덮어쓰지 않음', async () => {
    const before = await count('public.csat_dcp_items')
    const qBefore = await count('public.content_qualification')
    const r = await admitCandidates(admin, reader, input(), { isolated: true })
    if (!r.ok) throw new Error(r.code)
    expect(r.items.map((i) => i.dcp_item_id)).toEqual(happy.items.map((i) => i.dcp_item_id))
    expect(r.items.every((i) => i.replayed)).toBe(true)
    expect(r.items.map((i) => i.qualification_id)).toEqual(happy.items.map((i) => i.qualification_id))
    expect(await count('public.content_qualification')).toBe(qBefore)
    const plan = planAdmission({ ...input(), currentSource: (await reader(SOURCE_ID))! })
    const it0 = plan.items[0]!
    const res = await admin.rpc('factory_dcp_admit', { p_request_key: it0.request_key, p_body: { ...it0.body, task_id: 'LP-other' } })
    expect(res.error?.message).toMatch(/different body/)
    const edited = { ...output, items: output.items.map((i, k) => (k ? i : { ...i, explanation: { ...i.explanation, interpretation: `${i.explanation.interpretation} 수정판.` } })) }
    const conflict = await admitCandidates(admin, reader, input({ out: edited }), { isolated: true })
    expect(conflict).toMatchObject({ ok: false, code: 'factory_dcp_admit_failed' })
    expect((conflict as { detail: string }).detail).toMatch(/slot occupied/)
    expect(await count('public.csat_dcp_items')).toBe(before)
  })

  it('중간 오류(영수증 insert 실패)는 후보 행까지 되돌린다', async () => {
    await db.exec(`create function public.t_fail() returns trigger language plpgsql as $$ begin raise exception 'injected receipt failure'; end $$;
      create trigger t_fail before insert on public.factory_dcp_admission for each row execute function public.t_fail();`)
    const before = await count('public.csat_dcp_items')
    // 새 자리를 쓰도록 이미 등록된 행을 피한 문항 — 이 원천의 다른 문단 번호
    const plan = planAdmission({ ...input(), currentSource: (await reader(SOURCE_ID))! })
    const body = { ...plan.items[0]!.body, row: { ...plan.items[0]!.row, paragraph_idx: 7 } }
    const res = await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: body })
    expect(res.error?.message).toMatch(/injected receipt failure/)
    expect(await count('public.csat_dcp_items')).toBe(before)
    await db.exec(`drop trigger t_fail on public.factory_dcp_admission; drop function public.t_fail();`)
  })
})

describe('C3 · 관리자/학습자 분리 · 명시적 줄', () => {
  it('Supabase default service privileges cannot bypass either receipt writer', async () => {
    for (const table of ['factory_dcp_admission', 'factory_dcp_qualification']) {
      expect(await q1(`select has_table_privilege('service_role', $1, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') writes,
        has_table_privilege('service_role', $1, 'SELECT') reads`, [`public.${table}`])).toEqual({ writes: false, reads: true })
    }
  })

  it('both receipt tables reject direct inserts outside the supply writer', async () => {
    await db.query(`select set_config('vocaflow.supply_writer', '', false)`)
    for (const table of ['factory_dcp_admission', 'factory_dcp_qualification']) {
      await expect(db.exec(`insert into public.${table} default values`)).rejects.toThrow(/insert only via supply functions/)
    }
  })

  it('학습자 · 로그아웃 세션은 등록할 수 없고 영수증 · 원본 revision 함수에 쓰기/실행 권한이 없다', async () => {
    const plan = planAdmission({ ...input(), currentSource: (await reader(SOURCE_ID))! })
    for (const uid of [A, null]) expect((await client(uid).rpc('factory_dcp_admit', { p_request_key: key(), p_body: plan.items[0]!.body })).error?.message).toMatch(/Forbidden/)
    expect(await q1(`select has_table_privilege('authenticated','public.factory_dcp_admission','INSERT,UPDATE,DELETE') w,
      has_table_privilege('anon','public.factory_dcp_admission','SELECT') anon_r,
      has_function_privilege('authenticated','public.supply_artifact_revision_pre_dcp_admission(text,text)','execute') pre,
      has_function_privilege('anon','public.factory_dcp_admit(uuid,jsonb)','execute') anon_x`)).toEqual({ w: false, anon_r: false, pre: false, anon_x: false })
  })

  it('다른 학습자의 줄 · 닫힌 Workspace · 역할이 다른 줄은 공급 거절', async () => {
    const q = happy.items[0]!.qualification_id!
    expect(await receive(B, happy.line, q, happy.approval)).toMatchObject({ ok: false })
    const lineB = await lineFor(B, wsB, 'independent_check')
    const r = await receive(B, lineB, q, happy.approval)
    expect(r).toMatchObject({ ok: false })
    expect((r as { detail: string }).detail).toMatch(/identity mismatch|not allowed|role|spec mismatch/)
    const lineB2 = await lineFor(B, wsB)
    await db.query(`update public.learner_workspace set status = 'closed' where id = $1`, [wsB])
    const closed = await receive(B, lineB2, q, happy.approval)
    expect(closed).toMatchObject({ ok: false })
    await db.query(`update public.learner_workspace set status = 'active' where id = $1`, [wsB])
    expect((closed as { detail: string }).detail).toMatch(/not active|personal order not current/)
  })
})

describe('Codex C3 independent current-plan counterexample', () => {
  it('rejects supply for a demand made against a superseded plan', async () => {
    await db.exec('begin')
    try {
    const line = await lineFor(B, wsB, 'guided_practice', 10, 1)
    const ap = await approveForGuidedPractice(admin, happy.items[2]!.qualification_id!, 'current-plan regression')
    if (!ap.ok) throw new Error(ap.code)
    await db.query(`insert into public.learner_workspace_plan (workspace_id,user_id,plan_version) values ($1,$2,2)`, [wsB, B])
    const before = await count('public.workspace_content_delivery')
    const result = await receive(B, line, happy.items[2]!.qualification_id!, ap.data)
    expect(result).toMatchObject({ ok: false })
    expect((result as { detail: string }).detail).toMatch(/personal order not current/)
    expect(await count('public.workspace_content_delivery')).toBe(before)
    // 최신 plan 으로 새 수요를 만들면 같은 자격 · 승인으로 공급된다
    const fresh = await receive(B, await lineFor(B, wsB), happy.items[2]!.qualification_id!, ap.data)
    if (!fresh.ok) throw new Error(`${fresh.code} ${fresh.detail}`)
    } finally {
      await db.exec('rollback')
    }
  })
})

describe('1C 수정 — 현재 계보 · D3 링크 · 자격 복구(실제 SQL)', () => {
  const tx = async (fn: () => Promise<void>) => { await db.exec('begin'); try { await fn() } finally { await db.exec('rollback') } }
  // 정상 경로에서 이미 승인된 item 0 의 승인을 다시 쓴다(같은 자격 재승인은 기존 RPC 가 막는다)
  const approved = async () => happy.approval
  const learnerOpen = async (uid: string, line: string) => {
    const r = await client(uid).rpc<string>('factory_order_open', { p_line: line, p_reason: 'initial', p_quantity: 3, p_request_key: key() })
    if (r.error) throw new Error(r.error.message)
    return r.data!
  }
  const deliver = (uid: string, line: string, order: string, ap: string) =>
    client(uid).rpc<string>('workspace_delivery_record', { p_line: line, p_order: order, p_qualification: happy.items[0]!.qualification_id, p_approval: ap, p_request_key: key() })

  it('링크 뒤 goal 변경(TOCTOU) — 링크는 성공했어도 납품 RPC 가 거절', () => tx(async () => {
    const ap = await approved()
    const line = await lineFor(A, wsA)
    const order = await learnerOpen(A, line)
    expect(await linker()(order)).toMatchObject({ ok: true })
    await db.query(`insert into public.csat_map_goal_version (user_id) values ($1)`, [A])
    expect((await deliver(A, line, order, ap)).error?.message).toMatch(/personal lineage not current/)
  }))

  it('납품 wrapper 는 승인 writer 와 같은 키로 목표 → 계획 → Workspace 행 → 주문 행 순서로 현재성 조회 전에 잠근다(정적 · 단일 연결)', () => {
    const writer = read('20261010180218_map_v4_plan.sql')
    expect(writer).toContain(`pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text))`)
    expect(writer).toContain(`pg_advisory_xact_lock(hashtext('map_plan:' || p_user::text || ':' || p_template))`)
    const sql = read('_pending_factory_dcp_admission.sql').replace(/\r\n/g, '\n')
    const body = sql.slice(sql.indexOf('create function public.workspace_delivery_record('))
    const at = (s: string) => { const i = body.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i }
    const goal = at(`pg_advisory_xact_lock(hashtext('map_goal:' || v_user::text))`)
    const plan = at(`pg_advisory_xact_lock(hashtext('map_plan:' || v_user::text || ':' || v_template))`)
    const ws = at('w.template_id = v_template for update')
    const ord = at('from factory_order where id = p_order for update')
    const current = at('factory_lineage_personal_current(p_order)')
    expect(goal).toBeLessThan(plan); expect(plan).toBeLessThan(ws); expect(ws).toBeLessThan(ord); expect(ord).toBeLessThan(current)
    // 사용자 · 템플릿은 auth.uid() 소유 주문과 그 Workspace 행에서만 유도한다(클라이언트 인자 아님)
    expect(body).toMatch(/into v_user, v_ws from factory_order f where f\.id = p_order and f\.user_id = auth\.uid\(\)/)
    expect(body).toMatch(/select w\.template_id into v_template from learner_workspace w where w\.id = v_ws and w\.user_id = v_user/)
  })

  it('정상 납품 트랜잭션은 실제로 목표 · 계획 자문 잠금(writer 와 같은 키)을 쥔다', () => tx(async () => {
    const ap = await approved()
    const line = await lineFor(A, wsA)
    const order = await learnerOpen(A, line)
    expect(await linker()(order)).toMatchObject({ ok: true })
    const r = await deliver(A, line, order, ap)
    expect(r.error).toBeNull()
    const tpl = (await q1<{ t: string }>(`select template_id t from public.learner_workspace where id = $1`, [wsA])).t
    const held = async (k: string) => (await q1<{ n: number }>(
      `select count(*)::int n from pg_locks, (select hashtext($1)::bigint k) x where locktype = 'advisory'
         and classid::bigint = ((x.k >> 32) & 4294967295) and objid::bigint = (x.k & 4294967295)`, [k])).n
    expect(await held(`map_goal:${A}`)).toBeGreaterThan(0)
    expect(await held(`map_plan:${A}:${tpl}`)).toBeGreaterThan(0)
  }))

  it('링크 뒤 plan 변경 — 납품 RPC 가 거절', () => tx(async () => {
    const ap = await approved()
    const line = await lineFor(A, wsA)
    const order = await learnerOpen(A, line)
    expect(await linker()(order)).toMatchObject({ ok: true })
    const v = (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [wsA])).v
    await db.query(`insert into public.learner_workspace_plan (workspace_id,user_id,plan_version) values ($1,$2,$3)`, [wsA, A, v + 1])
    expect((await deliver(A, line, order, ap)).error?.message).toMatch(/personal lineage not current/)
  }))

  it('링크 없이 직접 납품 · 다른 줄 · 다른 제품주문 링크는 거절', () => tx(async () => {
    const ap = await approved()
    const line = await lineFor(A, wsA)
    const order = await learnerOpen(A, line)
    expect((await deliver(A, line, order, ap)).error?.message).toMatch(/not linked to the admitted product order/)
    const other = await lineFor(A, wsA)
    expect((await deliver(A, other, order, ap)).error?.message).toMatch(/order\/line identity mismatch/)
    // 같은 spec 의 다른 제품주문(판 1 · 다른 id)을 등록하고 그쪽으로 링크하면 등록 영수증의 제품주문과 달라 거절
    const alt = { ...packet, body: { ...packet.body, order: { ...packet.body.order, product_order_id: `${packet.body.order.product_order_id}-alt` } } } as ProductionPacket
    const altCanonical = JSON.parse((await q1<{ c: string }>(`select canonical_order c from public.factory_product_order where product_order_id = $1`, [packet.body.order.product_order_id])).c)
    const altText = canonicalJson({ ...altCanonical, product_order_id: alt.body.order.product_order_id })
    const altHash = (await q1<{ h: string }>(`select encode(sha256(convert_to($1,'UTF8')),'hex') h`, [altText])).h
    await db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, canonical_order, spec, spec_hash, quantity, reason, registered_by, request_key)
      select $1, order_revision, $2, $3, spec, spec_hash, quantity, reason, registered_by, $4 from public.factory_product_order where product_order_id = $5`,
      [alt.body.order.product_order_id, altHash, altText, key(), packet.body.order.product_order_id])
    const r = await receive(A, await lineFor(A, wsA), happy.items[0]!.qualification_id!, ap,
      linker({ product_order_id: alt.body.order.product_order_id, order_revision: alt.body.order.order_revision, order_hash: altHash }))
    expect((r as { detail: string }).detail).toMatch(/not linked to the admitted product order/)
  }))

  it('링크 실패(학습자 actor · 철회된 제품주문) · 링크 뒤 철회는 공급 거절', () => tx(async () => {
    const ap = await approved()
    expect((await receive(A, await lineFor(A, wsA), happy.items[0]!.qualification_id!, ap, linker(productOf(packet), A)) as { detail: string }).detail).toMatch(/Forbidden/)
    const line = await lineFor(A, wsA)
    const order = await learnerOpen(A, line)
    expect(await linker()(order)).toMatchObject({ ok: true })
    const o = packet.body.order
    const w = await service.rpc('factory_product_order_withdraw', { p_actor: ADMIN, p_id: o.product_order_id, p_revision: o.order_revision, p_hash: o.order_hash, p_reason: '1C 철회', p_request: key() })
    expect(w.error).toBeNull()
    expect((await deliver(A, line, order, ap)).error?.message).toMatch(/product order not current/)
    expect((await receive(A, await lineFor(A, wsA), happy.items[0]!.qualification_id!, ap) as { detail: string }).detail).toMatch(/product not current/)
  }))

  it('자격 SQL 실패 후 재요청 복구 · 응답 유실 재요청 = 같은 id · 다른 인자 거절 · 학습자 거절', () => tx(async () => {
    // 같은 원천의 새 자리(문단 3)로 새 후보를 만든다
    const out2 = { ...output, items: output.items.map((i) => ({ ...i, explanation: { ...i.explanation, interpretation: `${i.explanation.interpretation} 판2.` } })) }
    const pk = { ...packet } as ProductionPacket
    await db.exec(`create function public.t_qfail() returns trigger language plpgsql as $$ begin raise exception 'injected qualification failure'; end $$;
      create trigger t_qfail before insert on public.content_qualification for each row execute function public.t_qfail();`)
    const plan = planAdmission({ ...input({ out: out2, p: pk }), currentSource: (await reader(SOURCE_ID))! })
    const it0 = plan.items[0]!
    const body = { ...it0.body, row: { ...it0.row, paragraph_idx: 3 } }
    const adm = await admin.rpc<{ dcp_item_id: string; artifact_revision: string }>('factory_dcp_admit', { p_request_key: key(), p_body: body })
    if (adm.error) throw new Error(adm.error.message)
    const { qualificationArgs } = await import('../dcp-admission')
    const args = qualificationArgs(plan, it0, adm.data!.dcp_item_id, adm.data!.artifact_revision)
    const qBefore = await count('public.content_qualification')
    const f1 = await admin.rpc('factory_dcp_qualify', { p_dcp_item: adm.data!.dcp_item_id, p_args: args })
    expect(f1.error?.message).toMatch(/injected qualification failure/)
    expect(await count('public.factory_dcp_qualification where dcp_item_id = $1', [adm.data!.dcp_item_id])).toBe(0)
    await db.exec(`drop trigger t_qfail on public.content_qualification; drop function public.t_qfail();`)
    const ok1 = await admin.rpc<string>('factory_dcp_qualify', { p_dcp_item: adm.data!.dcp_item_id, p_args: args })
    if (ok1.error) throw new Error(ok1.error.message)
    // 응답 유실 가정 — 같은 인자로 다시 보내면 같은 id, 행 추가 없음
    const ok2 = await admin.rpc<string>('factory_dcp_qualify', { p_dcp_item: adm.data!.dcp_item_id, p_args: args })
    expect(ok2.data).toBe(ok1.data)
    expect(await count('public.content_qualification')).toBe(qBefore + 1)
    expect((await admin.rpc('factory_dcp_qualify', { p_dcp_item: adm.data!.dcp_item_id, p_args: { ...args, p_method: '다른 판정' } })).error?.message).toMatch(/different body/)
    expect((await admin.rpc('factory_dcp_qualify', { p_dcp_item: happy.items[0]!.dcp_item_id, p_args: { ...args, p_ref: happy.items[0]!.dcp_item_id } })).error?.message).toMatch(/different body|do not match/)
    expect((await client(A).rpc('factory_dcp_qualify', { p_dcp_item: adm.data!.dcp_item_id, p_args: args })).error?.message).toMatch(/Forbidden/)
  }))
})

describe('C5 · 공급 거절 — 실패를 완료로 삼키지 않는다', () => {
  it('권리 근거가 없으면 후보만 · 자격 없음 · F unknown 자격은 승인 불가', async () => {
    const r = planAdmission({ ...input({ rights: null }), currentSource: (await reader(SOURCE_ID))! })
    expect(r.items.every((i) => !i.qualification_ready && i.held.includes('axis_F_unknown'))).toBe(true)
    // 같은 계약으로 직접 자격을 만들어도(F unknown) 기존 승인 RPC 가 막는다
    await as(db, ADMIN)
    const qid = (await q1<{ id: string }>(`select public.content_qualification_record('FQ1.1','dcp_item',$1,$2,'r.central_meaning','guided_practice',
      '{"A":{"state":"pass"},"B":{"state":"pass"},"C":{"state":"pass"},"D":{"state":"pass"},"E":{"state":"unknown"},"F":{"state":"unknown"},"G":{"state":"not_applicable"},"H":{"state":"pass"}}'::jsonb,
      $3,$4,null,null,null,null,null,'{axis_F_unknown}','{x}','AI 검수 — 사람 검수 아님',null) id`,
      [happy.items[1]!.dcp_item_id, happy.items[1]!.artifact_revision, packet.body.source.source_digest, packet.body.source.content_sha256])).id
    expect((await approveForGuidedPractice(admin, qid, 'x'))).toMatchObject({ ok: false, code: 'content_release_approve_failed' })
  })

  it('무승인 · 철회 · 미검수 문항(자격 없음)은 공급 거절', async () => {
    const line = await lineFor(B, wsB)
    expect(await receive(B, line, happy.items[1]!.qualification_id!, key())).toMatchObject({ ok: false, code: 'workspace_delivery_record_failed' })
    const ap = await approveForGuidedPractice(admin, happy.items[1]!.qualification_id!, 'revoke test')
    if (!ap.ok) throw new Error(ap.code)
    await as(db, ADMIN)
    await db.query(`select public.content_release_revoke($1, '1C 철회 시험')`, [ap.data])
    const r = await receive(B, await lineFor(B, wsB), happy.items[1]!.qualification_id!, ap.data)
    expect((r as { detail: string }).detail).toMatch(/approval revoked/)
  })

  it('합성 수요 · 미등록/철회 주문 · 지원 밖 역할 본문은 SQL 이 등록 거절', async () => {
    const plan = planAdmission({ ...input(), currentSource: (await reader(SOURCE_ID))! })
    const b: Record<string, unknown> = { ...plan.items[0]!.body, row: { ...plan.items[0]!.row, paragraph_idx: 9 } }
    const err = async (body: unknown) => (await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: body })).error?.message
    expect(await err({ ...b, synthetic_demand: true })).toMatch(/synthetic demand/)
    expect(await err({ ...b, role: 'independent_check' })).toMatch(/only guided_practice/)
    expect(await err({ ...b, order: { ...(b.order as object), order_hash: 'c'.repeat(64) } })).toMatch(/registered current product order/)
    expect(await err({ ...b, review: { ...(b.review as object), kind: 'human' } })).toMatch(/AI review reference/)
    const o = packet.body.order
    await db.exec('begin')
    try {
      await db.query(`insert into public.factory_product_order_withdrawal (product_order_id, order_revision, order_hash, reason, withdrawn_by, request_key) values ($1,$2,$3,'1C',$4,$5)`,
        [o.product_order_id, o.order_revision, o.order_hash, ADMIN, key()])
      expect(await err(b)).toMatch(/registered current product order/)
    } finally {
      await db.exec('rollback') // 뒤 시험이 같은 제품주문으로 D3 링크를 한다
    }
  })

  it('원문 변경 → 기존 공급 현재 유효성 false · 새 공급 거절 · 원천 부적격도 거절', async () => {
    const line = await lineFor(B, wsB)
    const ap = await approveForGuidedPractice(admin, happy.items[2]!.qualification_id!, 'source change test')
    if (!ap.ok) throw new Error(ap.code)
    await db.query(`insert into public.ineligible_sources values ($1)`, [SOURCE_ID])
    expect((await receive(B, line, happy.items[2]!.qualification_id!, ap.data) as { detail: string }).detail).toMatch(/source not eligible/)
    expect(await valid(happy.delivery)).toBe(false)
    await db.query(`delete from public.ineligible_sources where article_id = $1`, [SOURCE_ID])
    expect(await valid(happy.delivery)).toBe(true)
    await db.query(`update public.library_articles set content = content || ' Edited.' where id = $1`, [SOURCE_ID])
    expect(await valid(happy.delivery)).toBe(false)
    expect((await receive(B, await lineFor(B, wsB), happy.items[2]!.qualification_id!, ap.data) as { detail: string }).detail).toMatch(/artifact not found/)
    // 계획 단계도 바뀐 원문을 거절한다
    expect(await admitCandidates(admin, reader, input(), { isolated: true })).toMatchObject({ ok: false, code: 'source_changed' })
    expect(await count('public.workspace_content_delivery where id = $1', [happy.delivery])).toBe(1)
  })
})
