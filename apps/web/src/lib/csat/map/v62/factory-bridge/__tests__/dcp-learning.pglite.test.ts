// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-learning.pglite.test.ts
// 1D D1~D4 — 실제 1B core + 실제 SQL(C → B → I1 → I2 → G2 → D3 → 1C dcp_admission → 1D dcp_learning) + **실제 grade_dcp_item 본문**
// (20260920120000 파일에서 그대로 잘라 적용)을 격리 PGlite 에 올려 등록 → 자격 → 승인 → 링크 → 납품 → 목록 → 열기 → 제출 → 재전송을
// 서비스(dcp-supply.ts · dcp-learning.ts)로 잇는다. 공유 DB · 환경 키 · 네트워크 없음.
// 대역(명시): auth.uid() = 하네스 jwt claim · csat_source_is_gradeable = 스텁 적격 함수(밴드 판정 표 없음) · csat_item_attempts 최소 열 ·
//   원천 행과 등록 제품주문은 시험 DB 에 직접 넣는다(1C 시험과 같은 경계). 채점 대역은 쓰지 않는다.
// ⚠️ PGlite 는 슈퍼유저 단일 연결이라 RLS 를 실행하지 않는다 — 실제 동시성 · 인증 · 공유 DB 는 NOT_RUN.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import { canonicalJson } from '../../canonical-json'
import type { WorkspaceDemand } from '../../demand'
import { canonicalDemand } from '../../persist-contract'
import { B_SQL, C_SQL, STUB, as } from '../../__tests__/supply-sql-harness'
import { listFactoryDeliveries, openFactoryDelivery, submitFactoryAttempt } from '../dcp-learning'
import { admitCandidates, approveForGuidedPractice, d3Linker, receiveForLearner, type SourceReader, type SupplyClient } from '../dcp-supply'
import type { ProductionOutput, ProductionPacket } from '../local-production'
import { fileSha, outputOf, packetOf, prepared, reviewOf, row } from './dcp-fixture'

const MIG = path.resolve(__dirname, '../../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.resolve(__dirname, '../../__tests__/supply-i1-stub.sql'), 'utf8')
/** 실제 적용된 grade_dcp_item 정의(이후 적용 덮어쓰기 없음 — _pending_grade_dcp_underline_choice 는 미적용) */
const GRADE_SQL = (() => {
  const s = read('20260920120000_grade_dcp_band_is_fit_not_eligibility.sql')
  const a = s.indexOf('CREATE OR REPLACE FUNCTION public.grade_dcp_item')
  const b = s.indexOf('END $function$;', a)
  if (a < 0 || b < 0) throw new Error('grade_dcp_item definition not found')
  return s.slice(a, b + 'END $function$;'.length)
})()
const PRE = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now();
  alter table public.learning_sessions add column if not exists stage text;
  alter table public.csat_dcp_items alter column id set default gen_random_uuid();
  alter table public.csat_dcp_items add column item_role text not null default 'practice', add column paragraph_idx int not null default 0,
  add constraint csat_dcp_items_slot unique (kind, ref_id, type, paragraph_idx);
  alter table public.csat_item_attempts alter column id drop default;
  alter table public.csat_item_attempts alter column id type uuid using gen_random_uuid(), alter column id set default gen_random_uuid();
  alter table public.csat_item_attempts add column text_id uuid, add column is_correct boolean, add column item_role text;
  create table public.library_articles (id uuid primary key, content text not null, row jsonb not null);
  create function public.csat_source_is_gradeable(p uuid) returns boolean language sql stable as $$ select public.csat_source_is_eligible(p) $$;
  create role service_role nologin;
  create table public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed', 'csat_map_viewed']::text[])));`

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let wsA: string
let packet: ProductionPacket
let output: ProductionOutput
const q1 = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!
const count = async (sql: string, p: unknown[] = []) => (await q1<{ n: number }>(`select count(*)::int n from ${sql}`, p)).n

const client = (uid: string | null): SupplyClient => ({
  async rpc<T>(fn: string, args: Record<string, unknown>) {
    await as(db, uid)
    const keys = Object.keys(args)
    const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v })
    const inTx = db.isInTransaction()
    if (inTx) await db.exec('savepoint rpc')
    try {
      const r = await db.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) r`, vals)
      if (inTx) await db.exec('release savepoint rpc')
      return { data: r.rows[0]!.r, error: null }
    } catch (e) {
      if (inTx) await db.exec('rollback to savepoint rpc')
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }
    }
  },
})
const admin = client(ADMIN)
const learnerA = client(A)
const learnerB = client(B)
const reader: SourceReader = async (id) => {
  const r = (await db.query<{ content: string; row: Record<string, unknown> }>(`select content, row from public.library_articles where id = $1`, [id])).rows[0]
  return r ? { snapshot_kind: 'read_only_database_export', current_time: '2026-10-21T07:00:00Z', row: { ...r.row, content: r.content } } : null
}
const RIGHTS = { record_id: 'isolated-rights-fixture#cc0', basis: 'isolated_harness_only' }

async function lineFor(uid: string, ws: string): Promise<string> {
  const planVersion = (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [ws])).v
  const spec = packet.body.spec as unknown as { definition: string; types: string[]; keys: string[]; requires: Record<string, unknown> }
  const d = {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion, definitionVersion: spec.definition,
    asOf: '2026-10-21T00:00:00Z', core: 'r.central_meaning', support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [{ role: 'guided_practice', task: 'r.central_meaning', quantity: { n: 10 }, csatTypes: spec.types, taskKeys: spec.keys, requires: spec.requires, reason: `need-${++n}` }],
  } as unknown as WorkspaceDemand
  await as(db, uid)
  const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, d)])).id
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
}
const signatureOf = async (order: string) =>
  (await db.query<{ s: string }>(`select d.signature s from public.factory_order o join public.workspace_content_demand_line l on l.id = o.line_id
    join public.workspace_content_demand d on d.id = l.demand_id where o.id = $1`, [order])).rows[0]?.s ?? null
const product = () => ({ product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision, order_hash: packet.body.order.order_hash })
const linker = () => d3Linker(client(null), ADMIN, product(), signatureOf, { quantity: 3, reason: '1D 격리 공급', requestKey: () => key() })

/** 개인 주문 하나에 문항 셋 모두 납품 — 1C 서비스 그대로 */
let deliveries: { type: string; delivery: string; dcp: string; approval: string; answer: number }[] = []

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(PRE)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`)
  for (const s of [C_SQL, B_SQL, read('_pending_workspace_supply_i1_safety.sql'), read('_pending_workspace_supply_i1_partial.sql'),
    read('20261018120000_workspace_supply_c_annotation_binding.sql'), read('20261018120100_r5_delivery_g2_binding.sql'),
    read('20261020063000_factory_product_order_lineage_v1.sql'), GRADE_SQL, read('_pending_factory_dcp_admission.sql'),
    read('_pending_factory_dcp_learning.sql')]) await db.exec(s)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  packet = await packetOf(false)
  output = outputOf(packet)
  const { content, ...rest } = row()
  await db.query(`insert into public.library_articles (id, content, row) values ($1, $2, $3::jsonb)`, [packet.body.source.id, content, JSON.stringify(rest)])
  const prep = await prepared()
  await db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, canonical_order, spec, spec_hash, quantity, reason, registered_by, request_key)
    values ($1, $2, $3, $4, $5::jsonb, encode(sha256(convert_to(public.factory_lineage_canonical($5::jsonb), 'UTF8')), 'hex'), 3, 'isolated 1D', $6, $7)`,
    [packet.body.order.product_order_id, packet.body.order.order_revision, packet.body.order.order_hash,
      canonicalJson((prep as unknown as { factory: { order: unknown } }).factory.order), JSON.stringify({ ...packet.body.spec, schema: 'vf.factory-lineage-spec/1' }), ADMIN, key()])
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  const wsB = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [B])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1), ($3, $4, 1)`, [wsA, A, wsB, B])

  const r = await admitCandidates(admin, reader, { packet, output, outputSha256: fileSha(output), review: reviewOf(packet, output), rights: RIGHTS }, { isolated: true })
  if (!r.ok) throw new Error(`${r.code} ${r.detail ?? ''}`)
  const line = await lineFor(A, wsA)
  let orderId: string | null = null
  for (const it of r.items) {
    const ap = await approveForGuidedPractice(admin, it.qualification_id!, '1D 격리 — AI 검수 기반 후보')
    if (!ap.ok) throw new Error(ap.code)
    const d = await receiveForLearner(learnerA, orderId ? async () => ({ ok: true, link_id: 'existing' }) : linker(),
      { lineId: line, orderId, quantity: 3, qualificationId: it.qualification_id!, approvalId: ap.data, orderKey: key(), deliveryKey: key() })
    if (!d.ok) throw new Error(`${d.code} ${d.detail}`)
    orderId = d.order_id
    const t = await q1<{ type: string; answer: number }>(`select type, (answer_key->>'answer')::int answer from public.csat_dcp_items where id = $1`, [it.dcp_item_id])
    deliveries.push({ type: t.type, delivery: d.delivery_id, dcp: it.dcp_item_id, approval: ap.data, answer: t.answer })
  }
  deliveries = deliveries.sort((x, y) => x.type.localeCompare(y.type))
}, 180000)

const byType = (t: string) => deliveries.find((d) => d.type === t)!

describe('D1 · 목록 → 열기 → 실제 채점 → 결속 영수증', () => {
  it('keeps already delivered materials usable after the production order is fulfilled', async () => {
    await db.exec('begin')
    try {
      const t = byType('topic')
      const d = await q1<{ order_id: string; qualification_id: string }>(`select order_id,qualification_id from public.workspace_content_delivery where id=$1`, [t.delivery])
      const transition = async (from: string, to: string, qualification: string | null) => {
        const r = await admin.rpc('factory_order_transition', { p_order: d.order_id, p_expected: from, p_to: to,
          p_reason: 'Codex fulfilled-order counterexample', p_run_id: null, p_qualification: qualification, p_request_key: key() })
        if (r.error) throw new Error(r.error.message)
      }
      await transition('requested', 'stock_search', null)
      await transition('stock_search', 'delivered', d.qualification_id)
      expect((await q1<{ state: string }>(`select state from public.factory_order where id=$1`, [d.order_id])).state).toBe('delivered')
      const opened = await openFactoryDelivery(learnerA, t.delivery)
      expect(opened.ok).toBe(true)
      expect(await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: key() })).toMatchObject({ ok: true, result: { correct: true } })
      // 생산 안전 계약은 그대로 — 완료 주문에 새 납품 · 링크를 여는 기존 판정은 여전히 false
      expect((await q1<{ v: boolean }>(`select public.factory_lineage_personal_current($1) v`, [d.order_id])).v).toBe(false)
      // 완료 주문이어도 구 plan 은 막는다(새 plan 판본이 생기면 lineage_not_current) — 재전송은 저장된 결과 그대로
      const k = key()
      const kept = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
      if (!kept.ok) throw new Error(kept.code)
      await db.query(`savepoint plan2`)
      await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 2)`, [wsA, A])
      expect(await openFactoryDelivery(learnerA, t.delivery)).toEqual({ ok: false, code: 'lineage_not_current' })
      expect(await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: key() })).toEqual({ ok: false, code: 'lineage_not_current' })
      const replay = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
      expect(replay.ok && replay.result).toMatchObject({ receiptId: kept.result.receiptId, replayed: true })
      await db.query(`rollback to savepoint plan2`)
      // 완료 주문이어도 닫힌 Workspace 는 막는다
      await db.query(`update public.learner_workspace set status = 'closed' where id = $1`, [wsA])
      expect(await openFactoryDelivery(learnerA, t.delivery)).toEqual({ ok: false, code: 'workspace_closed' })
    } finally { await db.exec('rollback') }
  })

  it('실패(failed) 주문의 자료는 학습용으로도 열지 않는다', async () => {
    await db.exec('begin')
    try {
      const t = byType('topic')
      const d = await q1<{ order_id: string }>(`select order_id from public.workspace_content_delivery where id=$1`, [t.delivery])
      const r = await admin.rpc('factory_order_transition', { p_order: d.order_id, p_expected: 'requested', p_to: 'failed',
        p_reason: '1D failed-order negative', p_run_id: null, p_qualification: null, p_request_key: key() })
      if (r.error) throw new Error(r.error.message)
      expect(await openFactoryDelivery(learnerA, t.delivery)).toEqual({ ok: false, code: 'lineage_not_current' })
      expect(await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: key() })).toEqual({ ok: false, code: 'lineage_not_current' })
    } finally { await db.exec('rollback') }
  })

  it('목록: 본인 Workspace 의 3문항 · 지문은 1개로 센다', async () => {
    const r = await listFactoryDeliveries(learnerA, 'ws.reading')
    if (!r.ok) throw new Error(r.code)
    expect(r.list.workspaceId).toBe(wsA)
    expect(r.list.items).toBe(3)
    expect(r.list.sources).toBe(1)
    expect(r.list.rows.every((x) => x.state === 'ok' && x.attempts === 0 && x.lastCorrect === null)).toBe(true)
    const other = await listFactoryDeliveries(learnerB, 'ws.reading')
    expect(other.ok && other.list.rows.length).toBe(0)
  })

  it('D2 열기: 답변 전 passage · stem · choices 만 — 정답 · 해설 없음', async () => {
    const r = await openFactoryDelivery(learnerA, byType('topic').delivery)
    if (!r.ok) throw new Error(r.code)
    expect(Object.keys(r.opened.item.payload).sort()).toEqual(['choices', 'passage', 'stem_ko'])
    const raw = await learnerA.rpc<Record<string, unknown>>('factory_dcp_open', { p_delivery: byType('topic').delivery })
    expect(JSON.stringify(raw.data)).not.toMatch(/answer_key|explanation|rationale|"answer"/)
  })

  it('오답 제출 → 실제 grade_dcp_item 시도 행 + 영수증 · 정답키 공개 · 근거 아님', async () => {
    const t = byType('topic')
    const wrong = t.answer === 1 ? 2 : 1
    const before = await count('public.csat_item_attempts')
    const r = await submitFactoryAttempt(learnerA, t.delivery, { choice: wrong, mutationId: key() })
    if (!r.ok) throw new Error(r.code)
    expect(r.result).toMatchObject({ correct: false, evidence: false, nonEvidenceReason: 'role_not_evidence', replayed: false })
    expect(r.result.answerKey?.answer).toBe(t.answer)
    expect(await count('public.csat_item_attempts')).toBe(before + 1)
    expect(await q1(`select user_id, dcp_item_id, is_correct, item_role from public.csat_item_attempts where id::text = $1`, [r.result.csatAttemptId]))
      .toEqual({ user_id: A, dcp_item_id: t.dcp, is_correct: false, item_role: 'practice' })
    expect(await q1(`select evidence, non_evidence_reason, grader, workspace_id from public.factory_dcp_attempt where id = $1`, [r.result.receiptId]))
      .toEqual({ evidence: false, non_evidence_reason: 'role_not_evidence', grader: 'grade_dcp_item@20260920120000', workspace_id: wsA })
  })

  it('정답 제출 → correct=true · 목록에 시도 수 · 최근 정오 반영', async () => {
    const t = byType('title')
    const r = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: key() })
    if (!r.ok) throw new Error(r.code)
    expect(r.result.correct).toBe(true)
    expect(r.result.answerKey?.answer).toBeUndefined()
    const l = await listFactoryDeliveries(learnerA, 'ws.reading')
    if (!l.ok) throw new Error(l.code)
    expect(l.list.rows.find((x) => x.type === 'title')).toMatchObject({ attempts: 1, lastCorrect: true })
  })
})

describe('D3 · 멱등 · 재전송 · 키 재사용 거절', () => {
  it('같은 키 같은 응답 = 같은 결과(행 추가 없음) · 다른 응답 · 다른 납품 = 거절', async () => {
    const t = byType('main_point')
    const k = key()
    const first = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
    if (!first.ok) throw new Error(first.code)
    const rows = await count('public.factory_dcp_attempt')
    const grades = await count('public.csat_item_attempts')
    const again = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
    if (!again.ok) throw new Error(again.code)
    expect(again.result).toMatchObject({ receiptId: first.result.receiptId, csatAttemptId: first.result.csatAttemptId, correct: true, replayed: true })
    expect(await count('public.factory_dcp_attempt')).toBe(rows)
    expect(await count('public.csat_item_attempts')).toBe(grades)
    expect(await submitFactoryAttempt(learnerA, t.delivery, { choice: (t.answer % 5) + 1, mutationId: k })).toEqual({ ok: false, code: 'conflict' })
    expect(await submitFactoryAttempt(learnerA, byType('topic').delivery, { choice: 1, mutationId: k })).toEqual({ ok: false, code: 'conflict' })
  })

  it('중간 실패(영수증 insert 실패)는 채점 시도 행도 함께 되돌린다', async () => {
    const t = byType('topic')
    const grades = await count('public.csat_item_attempts')
    await db.exec(`create function public.t_fail() returns trigger language plpgsql as $$ begin raise exception 'injected'; end $$;
      create trigger t_fail before insert on public.factory_dcp_attempt for each row execute function public.t_fail();`)
    const k = key()
    const r = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
    expect(r).toEqual({ ok: false, code: 'query_failed' })
    expect(await count('public.csat_item_attempts')).toBe(grades)
    await db.exec(`drop trigger t_fail on public.factory_dcp_attempt; drop function public.t_fail();`)
    const retry = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
    expect(retry.ok && retry.result.correct).toBe(true)
  })

  it('직접 insert(writer 설정 없음)는 supply_writer_guard 가 막는다', async () => {
    const t = byType('topic')
    const att = await q1<{ id: string }>(`select id from public.csat_item_attempts where user_id = $1 limit 1`, [A])
    await as(db, A)
    await expect(db.query(`insert into public.factory_dcp_attempt (user_id, mutation_id, delivery_id, workspace_id, dcp_item_id, artifact_revision,
      answer, answer_hash, csat_attempt_id, is_correct, result, grader, role, task_id) values ($1, $2, $3, $4, $5, 'r', '{"choice":1}', $6, $7, true, '{}',
      'grade_dcp_item@20260920120000', 'guided_practice', 'r.central_meaning')`, [A, key(), t.delivery, wsA, t.dcp, 'a'.repeat(64), att.id]))
      .rejects.toThrow(/insert only via supply functions/)
  })

  describe('채점 시도 결속 — 가짜 · 남의 · 다른 문항 · 정오 불일치 · 정오 누락은 저장하지 않는다', () => {
    const fakeGrader = async (body: string) => db.exec(`create or replace function public.grade_dcp_item(p_item_id uuid, p_answer jsonb)
      returns jsonb language plpgsql security definer set search_path to 'public' as $f$ declare v uuid; begin ${body} end $f$;`)
    it.each([
      ['없는 id', `return jsonb_build_object('correct', true, 'attempt_id', gen_random_uuid());`],
      ['UUID 아님', `return jsonb_build_object('correct', true, 'attempt_id', 'nope');`],
      ['정오 누락', `insert into csat_item_attempts (user_id, dcp_item_id, is_correct) values (auth.uid(), p_item_id, null) returning id into v;
        return jsonb_build_object('attempt_id', v);`],
      ['다른 사용자', `insert into csat_item_attempts (user_id, dcp_item_id, is_correct) values ('${B}', p_item_id, true) returning id into v;
        return jsonb_build_object('correct', true, 'attempt_id', v);`],
      ['다른 문항', `insert into csat_item_attempts (user_id, dcp_item_id, is_correct) values (auth.uid(), (select id from csat_dcp_items where id <> p_item_id limit 1), true) returning id into v;
        return jsonb_build_object('correct', true, 'attempt_id', v);`],
      ['정오 불일치', `insert into csat_item_attempts (user_id, dcp_item_id, is_correct) values (auth.uid(), p_item_id, false) returning id into v;
        return jsonb_build_object('correct', true, 'attempt_id', v);`],
    ])('%s → query_failed · 영수증 · 시도 행 증가 없음', async (_label, body) => {
      await db.exec('begin')
      try {
        await fakeGrader(body)
        const receipts = await count('public.factory_dcp_attempt')
        const grades = await count('public.csat_item_attempts')
        expect(await submitFactoryAttempt(learnerA, byType('topic').delivery, { choice: 1, mutationId: key() })).toEqual({ ok: false, code: 'query_failed' })
        expect(await count('public.factory_dcp_attempt')).toBe(receipts)
        expect(await count('public.csat_item_attempts')).toBe(grades)
      } finally { await db.exec('rollback') }
    })
  })

  it('응답 모양: choice 외 필드 · 범위 밖 · 문자열은 DB 가 거절', async () => {
    for (const ans of [{ choice: 6 }, { choice: '1' }, { choice: 1, correct: true }]) {
      const r = await learnerA.rpc('factory_dcp_attempt', { p_delivery: byType('topic').delivery, p_answer: ans, p_mutation: key() })
      expect(r.error?.message).toMatch(/answer must be/)
    }
  })
})

describe('D4 · 타인 · 닫힌 Workspace · 철회 · 원문 변경 · 비공장 납품 거절', () => {
  it('타인은 열기 · 제출 모두 not_found(존재를 알리지 않는다)', async () => {
    expect(await openFactoryDelivery(learnerB, byType('topic').delivery)).toEqual({ ok: false, code: 'not_found' })
    expect(await submitFactoryAttempt(learnerB, byType('topic').delivery, { choice: 1, mutationId: key() })).toEqual({ ok: false, code: 'not_found' })
  })

  it('승인 철회 → not_current · 지난 결과 재전송은 저장된 결과 그대로', async () => {
    const t = byType('title')
    const k = key()
    const before = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
    if (!before.ok) throw new Error(before.code)
    await db.exec('begin')
    try {
      const rv = await admin.rpc('content_release_revoke', { p_approval: t.approval, p_reason: '1D 격리 철회 시험' })
      expect(rv.error).toBeNull()
      expect(await openFactoryDelivery(learnerA, t.delivery)).toEqual({ ok: false, code: 'not_current' })
      expect(await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: key() })).toEqual({ ok: false, code: 'not_current' })
      const replay = await submitFactoryAttempt(learnerA, t.delivery, { choice: t.answer, mutationId: k })
      expect(replay.ok && replay.result.receiptId).toBe(before.result.receiptId)
      const l = await listFactoryDeliveries(learnerA, 'ws.reading')
      expect(l.ok && l.list.rows.find((x) => x.type === 'title')?.state).toBe('not_current')
    } finally { await db.exec('rollback') }
  })

  it('원문 본문이 바뀌면(구 원문) → 열기 거절', async () => {
    await db.exec('begin')
    try {
      await db.query(`update public.library_articles set content = content || ' changed' where id = $1`, [packet.body.source.id])
      const r = await openFactoryDelivery(learnerA, byType('topic').delivery)
      expect(r.ok).toBe(false)
      expect(['not_current', 'stale_revision']).toContain((r as { code: string }).code)
    } finally { await db.exec('rollback') }
  })

  it('닫힌 Workspace → workspace_closed', async () => {
    await db.exec('begin')
    try {
      await db.query(`update public.learner_workspace set status = 'closed' where id = $1`, [wsA])
      expect(await submitFactoryAttempt(learnerA, byType('topic').delivery, { choice: 1, mutationId: key() })).toEqual({ ok: false, code: 'workspace_closed' })
    } finally { await db.exec('rollback') }
  })

  it('제품 링크가 없는 납품은 product_link_mismatch(판정 함수 직접)', async () => {
    await db.exec('begin')
    try {
      await db.exec(`alter table public.factory_order_product_link disable trigger user`)
      await db.query(`delete from public.factory_order_product_link`)
      await as(db, A)
      // 개인 계보 판정이 링크를 먼저 볼 수도 있다 — 어느 쪽이든 'ok' 가 아니고 닫힌 거절 코드여야 한다
      expect(['product_link_mismatch', 'lineage_not_current']).toContain((await q1<{ s: string }>(`select public.factory_dcp_delivery_state($1) s`, [byType('topic').delivery])).s)
    } finally { await db.exec('rollback') }
  })

  // 1C 래퍼가 이런 납품 생성을 막으므로, 손상된 과거 행은 격리 PGlite 에서만 트리거를 끄고 만든다(공유 DB 아님)
  it.each([
    ['다른 역할', `role = 'independent_check'`, 'wrong_role_task'],
    ['다른 TASK', `task_id = 'r.option_match'`, 'wrong_role_task'],
    ['구 문항 판본', `artifact_revision = 'stale-rev'`, 'stale_revision'],
    ['DCP 가 아닌 산출물', `artifact_kind = 'annotation'`, 'not_factory_dcp'],
  ])('손상된 과거 납품(%s) → %s · 열기 · 제출 모두 거절', async (_l, set, code) => {
    await db.exec('begin')
    try {
      // FK · 사용자 트리거(writer 가드 · 추가 전용)를 이 트랜잭션에서만 끈다 — 손상 행 모사용
      await db.exec(`set local session_replication_role = replica`)
      for (const c of ['workspace_content_delivery_role_check', 'workspace_content_delivery_task_id_check', 'workspace_content_delivery_artifact_kind_check']) {
        await db.exec(`alter table public.workspace_content_delivery drop constraint if exists ${c}`)
      }
      await db.query(`update public.workspace_content_delivery set ${set} where id = $1`, [byType('topic').delivery])
      await db.exec(`set local session_replication_role = origin`)
      expect(await openFactoryDelivery(learnerA, byType('topic').delivery)).toEqual({ ok: false, code })
      expect(await submitFactoryAttempt(learnerA, byType('topic').delivery, { choice: 1, mutationId: key() })).toEqual({ ok: false, code })
    } finally { await db.exec('rollback') }
  })

  it('계측 CHECK — 기존 이름은 그대로 · 1D 세 이름 추가 · 모르는 이름은 거절', async () => {
    for (const e of ['screen_viewed', 'csat_map_viewed', 'csat_factory_dcp_opened', 'csat_factory_dcp_submitted', 'csat_factory_dcp_returned']) {
      await db.query(`insert into public.funnel_events (event) values ($1)`, [e])
    }
    await expect(db.query(`insert into public.funnel_events (event) values ('csat_factory_dcp_unknown')`)).rejects.toThrow(/funnel_events_event_check/)
  })

  it('없는 id · 비 UUID 는 거절', async () => {
    expect(await openFactoryDelivery(learnerA, key())).toEqual({ ok: false, code: 'not_found' })
    expect(await openFactoryDelivery(learnerA, 'nope')).toEqual({ ok: false, code: 'invalid_input' })
  })
})
