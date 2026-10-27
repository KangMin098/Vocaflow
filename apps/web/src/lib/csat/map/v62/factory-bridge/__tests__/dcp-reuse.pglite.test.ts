// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-reuse.pglite.test.ts
// 04 기존 DCP 재사용 — 정본 pending SQL 을 격리 PGlite 에 깔고, 실제 관측된 topic/title 행(읽기 전용 export 그대로)을 먼저 둔 뒤
// 원래 입고 충돌 → 재사용 입고(같은 id 2 + 신규 요지 1) → 자격 · 승인 · 학습자 공급 · 실제 grade_dcp_item 채점까지 잰다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import { canonicalJson } from '../../canonical-json'
import type { WorkspaceDemand } from '../../demand'
import { canonicalDemand } from '../../persist-contract'
import { B_SQL, C_SQL, STUB, as } from '../../__tests__/supply-sql-harness'
import { openFactoryDelivery, submitFactoryAttempt } from '../dcp-learning'
import { admitCandidates, admitReuse, approveForGuidedPractice, d3Linker, previewReuse, receiveForLearner, type ExistingRowReader, type SourceReader, type SupplyClient } from '../dcp-supply'
import { EXISTING_ROW_SELECT, adaptOutputToExisting, existingRowSha, planExistingDcpReuse, type ExistingDcpRow, type ReuseMapping } from '../dcp-reuse'
import type { ProductionOutput, ProductionPacket } from '../local-production'
import { fileSha, outputOf, packetOf, prepared, reviewOf, row, SOURCE_ID } from './dcp-fixture'

const MIG = path.resolve(__dirname, '../../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.resolve(__dirname, '../../__tests__/supply-i1-stub.sql'), 'utf8')
/** 2026-10-21 개발 DB 읽기 전용 SELECT 그대로(runtime/learning-outcomes-20261021/existing-source-items-readonly.json) */
const OBSERVED = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/existing-dcp-observed-20261021.json'), 'utf8')) as {
  source_id: string; rows: { id: string; type: string; payload: Record<string, unknown>; answer_key: Record<string, unknown> }[]
}
const GRADE_SQL = (() => {
  const s = read('20260920120000_grade_dcp_band_is_fit_not_eligibility.sql')
  const a = s.indexOf('CREATE OR REPLACE FUNCTION public.grade_dcp_item')
  const b = s.indexOf('END $function$;', a)
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
let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let wsA: string
let packet: ProductionPacket
let original: ProductionOutput
let adapted: ProductionOutput
let mapping: ReuseMapping[]
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
const reader: SourceReader = async (id) => {
  const r = (await db.query<{ content: string; row: Record<string, unknown> }>(`select content, row from public.library_articles where id = $1`, [id])).rows[0]
  return r ? { snapshot_kind: 'read_only_database_export', current_time: '2026-10-21T07:00:00Z', row: { ...r.row, content: r.content } } : null
}
/** 서버 SELECT 대역 — 실제 어댑터와 같은 투영 열을 같은 DB 에서 읽는다 */
const rowsReader: ExistingRowReader = async (ids) => {
  await db.exec('reset role')
  return (await db.query<ExistingDcpRow>(`select ${EXISTING_ROW_SELECT} from public.csat_dcp_items where id = any($1::uuid[])`, [ids])).rows
}
const RIGHTS = { record_id: 'isolated-rights-fixture#cc0', basis: 'isolated_harness_only' }
const currentRows = () => rowsReader(OBSERVED.rows.map((r) => r.id))
async function reuseReview(out: ProductionOutput, o: { existing?: unknown } = {}) {
  const rows = await currentRows()
  const existing_rows = o.existing ?? mapping.map((m) => ({ ...m, row_sha256: existingRowSha(rows.find((r) => r.id === m.dcp_item_id)!) }))
  const base = reviewOf(packet, out)
  return { ...base, target: { ...base.target, existing_rows } }
}
const reuseInput = async (o: { out?: ProductionOutput; review?: unknown; reuse?: ReuseMapping[] } = {}) => {
  const out = o.out ?? adapted
  return { packet, output: out, outputSha256: fileSha(out), review: o.review ?? (await reuseReview(out)), rights: RIGHTS, reuse: o.reuse ?? mapping }
}
const sha = async (id: string) => q1<{ p: string; k: string }>(`select md5(payload::text) p, md5(answer_key::text) k from public.csat_dcp_items where id = $1`, [id])

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

let before: { title: { p: string; k: string }; topic: { p: string; k: string }; items: number }
let adopted: { item_id: string; dcp_item_id: string; qualification_id: string | null }[]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(PRE)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`)
  for (const s of [C_SQL, B_SQL, read('_pending_workspace_supply_i1_safety.sql'), read('_pending_workspace_supply_i1_partial.sql'),
    read('20261018120000_workspace_supply_c_annotation_binding.sql'), read('20261018120100_r5_delivery_g2_binding.sql'),
    read('20261020063000_factory_product_order_lineage_v1.sql'), GRADE_SQL, read('_pending_authored_supply.sql'),
    read('_pending_authored_ai_review.sql'), read('_pending_factory_dcp_admission.sql'), read('_pending_factory_dcp_learning.sql')]) await db.exec(s)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  packet = await packetOf(false)
  original = outputOf(packet)
  const { content, ...rest } = row()
  await db.query(`insert into public.library_articles (id, content, row) values ($1, $2, $3::jsonb)`, [SOURCE_ID, content, JSON.stringify(rest)])
  // 관측된 기존 행 — 원래 legacy id · payload · answer_key 그대로
  for (const r of OBSERVED.rows)
    await db.query(`insert into public.csat_dcp_items (id, kind, ref_id, type, item_role, payload, answer_key, paragraph_idx) values ($1, 'article', $2, $3, 'practice', $4::jsonb, $5::jsonb, 0)`,
      [r.id, OBSERVED.source_id, r.type, JSON.stringify(r.payload), JSON.stringify(r.answer_key)])
  const prep = await prepared()
  await db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, canonical_order, spec, spec_hash, quantity, reason, registered_by, request_key)
    values ($1, $2, $3, $4, $5::jsonb, encode(sha256(convert_to(public.factory_lineage_canonical($5::jsonb), 'UTF8')), 'hex'), 3, 'isolated 04', $6, $7)`,
    [packet.body.order.product_order_id, packet.body.order.order_revision, packet.body.order.order_hash,
      canonicalJson((prep as unknown as { factory: { order: unknown } }).factory.order), JSON.stringify({ ...packet.body.spec, schema: 'vf.factory-lineage-spec/1' }), ADMIN, key()])
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [wsA, A])
  mapping = OBSERVED.rows.map((r) => ({ item_id: original.items.find((i) => i.type === r.type)!.id, dcp_item_id: r.id }))
  adapted = adaptOutputToExisting(original, mapping, await currentRows(), packet.body.source.content)
  const id = (t: string) => OBSERVED.rows.find((r) => r.type === t)!.id
  before = { title: await sha(id('title')), topic: await sha(id('topic')), items: await count('public.csat_dcp_items') }
}, 180000)

describe('04 · 원래 입고는 계속 거절', () => {
  it('같은 자리(title/topic)는 slot occupied — 기존 행 불변', async () => {
    await db.exec('begin')
    try {
      const r = await admitCandidates(admin, reader, { packet, output: original, outputSha256: fileSha(original), review: reviewOf(packet, original), rights: RIGHTS }, { isolated: true })
      expect(r).toMatchObject({ ok: false, code: 'factory_dcp_admit_failed' })
      expect((r as { detail: string }).detail).toMatch(/slot occupied/)
    } finally { await db.exec('rollback') }
    expect(await count('public.csat_dcp_items')).toBe(before.items)
  })
})

describe('04 · 재사용 미리보기 반례(쓰기 없음)', () => {
  it('맞춘 출력은 1B 출력 검증을 통과하고, 기존 해설 원문을 검수자에게 보인다', async () => {
    const p = await previewReuse(reader, rowsReader, await reuseInput())
    if (!p.ok) throw new Error(`${p.code} ${p.detail}`)
    expect(p.plan.reuse).toEqual({ adopted: 2, inserted: 1, atomic: 'per_item' })
    const title = p.plan.items.find((i) => i.item_id === 'cm-title-01')!
    expect(title.existing).toMatchObject({ dcp_item_id: '4dbcca67-2e17-4e96-a2d1-9d513b4b87b6', passage_scope: 'excerpt' })
    expect(p.plan.items.find((i) => i.item_id === 'cm-topic-01')!.existing!.passage_scope).toBe('full')
    expect(title.row.payload).toEqual(OBSERVED.rows.find((r) => r.type === 'title')!.payload)
    expect(adapted.items.find((i) => i.id === 'cm-title-01')!.explanation.observation).toContain(String(OBSERVED.rows.find((r) => r.type === 'title')!.answer_key.rationale_ko))
  })

  it('옛 검수(existing_rows 없음) · 임의 row hash · 누락 · 추가 · 잘못된 UUID · 다른 정답 · 다른 유형 거절', async () => {
    const reject = async (inp: Awaited<ReturnType<typeof reuseInput>>) => { const r = await previewReuse(reader, rowsReader, inp); return r.ok ? 'ok' : r.code }
    expect(await reject(await reuseInput({ review: reviewOf(packet, adapted) }))).toBe('reuse_review_missing_existing_rows')
    expect(await reject(await reuseInput({ review: await reuseReview(adapted, { existing: mapping.map((m) => ({ ...m, row_sha256: 'f'.repeat(64) })) }) }))).toBe('reuse_review_target_mismatch')
    expect(await reject(await reuseInput({ review: await reuseReview(adapted, { existing: [{ ...mapping[0], row_sha256: existingRowSha((await currentRows()).find((r) => r.id === mapping[0]!.dcp_item_id)!) }] }) }))).toBe('reuse_review_target_mismatch')
    expect(await reject(await reuseInput({ reuse: [mapping[0]!] }))).toBe('reuse_review_target_mismatch')
    expect(await reject(await reuseInput({ reuse: [mapping[0]!, { item_id: mapping[1]!.item_id, dcp_item_id: '00000000-0000-4000-8000-00000000dead' }] }))).toBe('reuse_existing_mismatch')
    const wrongKey = { ...adapted, items: adapted.items.map((i) => (i.id === 'cm-topic-01' ? { ...i, answer: '3' } : i)) } as ProductionOutput
    expect(await reject(await reuseInput({ out: wrongKey, review: await reuseReview(wrongKey) }))).toBe('reuse_existing_mismatch')
    const swapped = mapping.map((m, k) => ({ ...m, dcp_item_id: mapping[1 - k]!.dcp_item_id }))
    expect(await reject(await reuseInput({ reuse: swapped }))).toBe('reuse_existing_mismatch')
    // 원래 출력(다른 선지 · 정답)을 재사용으로 위장 → 발문 · 선지 · 정답 불일치
    expect(await reject(await reuseInput({ out: original, review: await reuseReview(original) }))).toBe('reuse_existing_mismatch')
  })

  it('원천 변경(발췌가 더는 현재 원문에 없음) · 계획 위조(passage 를 원문 밖으로) 거절', async () => {
    const rows = await currentRows()
    const forged = rows.map((r) => (r.type === 'title' ? { ...r, payload: { ...r.payload, passage: 'An invented passage that is not in the source text.' } } : r))
    expect(() => planExistingDcpReuse({ packet, output: adapted, outputSha256: fileSha(adapted), rights: RIGHTS, reuse: mapping, existingRows: forged,
      currentSource: { snapshot_kind: 'read_only_database_export', current_time: '2026-10-21T07:00:00Z', row: row() },
      review: { ...reviewOf(packet, adapted), target: { ...reviewOf(packet, adapted).target, existing_rows: mapping.map((m) => ({ ...m, row_sha256: existingRowSha(forged.find((r) => r.id === m.dcp_item_id)!) })) } } })).toThrow(/reuse_existing_mismatch.*passage_not_in_current_source/)
    await db.exec('begin')
    try {
      await db.query(`update public.library_articles set content = content || ' Edited.' where id = $1`, [SOURCE_ID])
      const r = await previewReuse(reader, rowsReader, await reuseInput())
      expect(r).toMatchObject({ ok: false, code: 'source_changed' })
    } finally { await db.exec('rollback') }
  })
})

describe('04 · SQL 은 잠근 현재 행으로 다시 잰다', () => {
  it('미리보기 뒤 payload · Gold 변경 경쟁 → 기존 행 결속 거절(새 행 없음)', async () => {
    const p = await previewReuse(reader, rowsReader, await reuseInput())
    if (!p.ok) throw new Error(p.code)
    const t = p.plan.items.find((i) => i.item_id === 'cm-title-01')!
    for (const change of [`payload = payload || '{"stem_ko":"바뀐 발문입니다만 길이는 충분"}'`, `answer_key = answer_key || '{"answer":2}'`]) {
      await db.exec('begin')
      try {
        await db.query(`update public.csat_dcp_items set ${change} where id = $1`, [t.existing!.dcp_item_id])
        const r = await admin.rpc('factory_dcp_admit', { p_request_key: t.request_key, p_body: t.body })
        expect(r.error?.message).toMatch(/changed since review/)
      } finally { await db.exec('rollback') }
    }
    // 다른 source/type 로 가리키기 · 존재하지 않는 id · 모양 오류
    const other = mapping.find((m) => m.item_id === 'cm-topic-01')!.dcp_item_id
    const r1 = await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: { ...t.body, existing: { ...(t.body.existing as object), dcp_item_id: other } } })
    expect(r1.error?.message).toMatch(/identity mismatch/)
    const r2 = await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: { ...t.body, existing: { ...(t.body.existing as object), dcp_item_id: '00000000-0000-4000-8000-00000000dead' } } })
    expect(r2.error?.message).toMatch(/existing dcp item not found/)
    const r3 = await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: { ...t.body, existing: { dcp_item_id: 'x' } } })
    expect(r3.error?.message).toMatch(/existing reference shape/)
    expect(await count('public.factory_dcp_admission')).toBe(0)
    expect(await count('public.csat_dcp_items')).toBe(before.items)
  })

  it('비관리자 · 로그아웃 세션은 재사용 입고 불가 · 기본 권한 회수 유지', async () => {
    expect(await admitReuse(learnerA, reader, rowsReader, await reuseInput(), { isolated: true })).toMatchObject({ ok: false, code: 'factory_dcp_admit_failed' })
    expect(await admitReuse(client(null), reader, rowsReader, await reuseInput(), { isolated: true })).toMatchObject({ ok: false, code: 'factory_dcp_admit_failed' })
    await db.exec('reset role')
    expect(await q1(`select has_function_privilege('anon','public.factory_dcp_admit(uuid,jsonb)','execute') anon_x,
      has_table_privilege('authenticated','public.factory_dcp_admission','insert') w`)).toEqual({ anon_x: false, w: false })
    expect(await count('public.factory_dcp_admission')).toBe(0)
  })
})

describe('04 · 재사용 입고 → 자격 → 승인 → 공급 → 실제 채점', () => {
  it.each((['B', 'C', 'D'] as const).flatMap(axis => ['fail', 'unknown', 'not_applicable'].map(state => ({ axis, state }))))('내용 검수 $axis=$state 는 기존 슬롯을 입고 영수증으로 예약하지 않는다', async ({ axis, state }) => {
    const input = await reuseInput()
    const review = structuredClone(input.review) as { axes: Record<string, { state: string; evidence: string[] }> }
    review.axes[axis] = { state, evidence: ['반례: 내용 검수가 통과되지 않은 후보'] }
    const before = await count('public.factory_dcp_admission')
    expect(await admitReuse(admin, reader, rowsReader, { ...input, review }, { isolated: true })).toMatchObject({ ok: false, code: 'content_review_not_pass' })
    expect(await count('public.factory_dcp_admission')).toBe(before)
  })

  it('같은 legacy id 2 + 신규 요지 1 · 기존 행 본문 불변 · 새 행 +1 · 사람 결정 행 없음', async () => {
    const r = await admitReuse(admin, reader, rowsReader, await reuseInput(), { isolated: true })
    if (!r.ok) throw new Error(`${r.code} ${r.detail ?? ''}`)
    adopted = r.items
    const byItem = (id: string) => r.items.find((i) => i.item_id === id)!
    for (const m of mapping) expect(byItem(m.item_id).dcp_item_id).toBe(m.dcp_item_id)
    expect(mapping.map((m) => m.dcp_item_id)).not.toContain(byItem('cm-main-point-01').dcp_item_id)
    expect(r.items.every((i) => i.qualification_id && !i.replayed)).toBe(true)
    expect(await count('public.csat_dcp_items')).toBe(before.items + 1)
    const id = (t: string) => OBSERVED.rows.find((x) => x.type === t)!.id
    expect(await sha(id('title'))).toEqual(before.title)
    expect(await sha(id('topic'))).toEqual(before.topic)
    const rec = await q1<{ body: { existing: { dcp_item_id: string; row_sha256: string } }; review_sha256: string }>(`select body, review_sha256 from public.factory_dcp_admission where dcp_item_id = $1`, [id('title')])
    expect(rec.body.existing.dcp_item_id).toBe(id('title'))
    expect(rec.review_sha256).toBe(r.plan.review.sha256)
    expect(await count('public.content_release_approval')).toBe(0)
  })

  it('재전송은 replayed · 행 증가 0 · 같은 기존 id 에 다른 본문 재입고는 거절', async () => {
    const items = await count('public.csat_dcp_items')
    const receipts = await count('public.factory_dcp_admission')
    const r = await admitReuse(admin, reader, rowsReader, await reuseInput(), { isolated: true })
    if (!r.ok) throw new Error(r.code)
    expect(r.items.every((i) => i.replayed)).toBe(true)
    expect(r.items.map((i) => i.dcp_item_id)).toEqual(adopted.map((i) => i.dcp_item_id))
    expect(await count('public.csat_dcp_items')).toBe(items)
    expect(await count('public.factory_dcp_admission')).toBe(receipts)
    const p = await previewReuse(reader, rowsReader, await reuseInput())
    if (!p.ok) throw new Error(p.code)
    const t = p.plan.items.find((i) => i.existing)!
    const again = await admin.rpc('factory_dcp_admit', { p_request_key: key(), p_body: { ...t.body, review: { ...(t.body.review as object), sha256: 'e'.repeat(64) } } })
    expect(again.error?.message).toMatch(/already admitted/)
  })

  it('재사용된 title 을 학습자 본인이 받아 실제 grade_dcp_item 으로 채점 · 기존 시도 행은 보존', async () => {
    const title = adopted.find((i) => i.item_id === 'cm-title-01')!
    const attemptsBefore = await count('public.csat_item_attempts where dcp_item_id = $1', [title.dcp_item_id])
    const ap = await approveForGuidedPractice(admin, title.qualification_id!, '04 격리 — 기존 행 재사용 AI 검수 후보')
    if (!ap.ok) throw new Error(ap.code)
    const line = await lineFor(A, wsA)
    const product = { product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision, order_hash: packet.body.order.order_hash }
    const d = await receiveForLearner(learnerA, d3Linker(client(null), ADMIN, product, signatureOf, { quantity: 3, reason: '04 격리 공급', requestKey: () => key() }),
      { lineId: line, quantity: 3, qualificationId: title.qualification_id!, approvalId: ap.data, orderKey: key(), deliveryKey: key() })
    if (!d.ok) throw new Error(`${d.code} ${d.detail}`)
    const opened = await openFactoryDelivery(learnerA, d.delivery_id)
    if (!opened.ok) throw new Error(opened.code)
    expect(opened.opened.item.payload.stem_ko).toBe(OBSERVED.rows.find((r) => r.type === 'title')!.payload.stem_ko)
    const s = await submitFactoryAttempt(learnerA, d.delivery_id, { choice: 1, mutationId: key() })
    if (!s.ok) throw new Error(s.code)
    expect(s.result.correct).toBe(true)
    expect(await count('public.csat_item_attempts where dcp_item_id = $1', [title.dcp_item_id])).toBe(attemptsBefore + 1)
    expect(await q1(`select user_id, dcp_item_id, workspace_id from public.factory_dcp_attempt where id = $1`, [s.result.receiptId]))
      .toEqual({ user_id: A, dcp_item_id: title.dcp_item_id, workspace_id: wsA })
  })
})
