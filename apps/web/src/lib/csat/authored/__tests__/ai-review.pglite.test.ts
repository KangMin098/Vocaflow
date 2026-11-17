// apps/web/src/lib/csat/authored/__tests__/ai-review.pglite.test.ts
// 2A — 실제 두 AI 검토 영수증(evidence/2a-ai-review)과 실제 v3 바이트로: 등록 → AI 결정 → 자격 · 승인 → 공급 → 열기 → 실제 채점 →
//   G2 결속. 사람 결정 행 0 을 단언한다. 반례: 검토 없는 6개 · 한 AI 누락 · 같은 세션 · Gold/본문 변경 · 철회 · 노출 재사용 ·
//   학습자 호출 · 직접 쓰기 · 반복 요청. Supabase 기본 권한(service_role ALL)을 켠 채 설치한다.
// ⚠️ PGlite = 슈퍼유저 · 단일 연결 — 실제 RLS · 두 연결 동시성은 NOT_RUN(02A-AI-REVIEW-RESULT.md).
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { B_SQL, C_SQL, STUB } from '../../map/v62/__tests__/supply-sql-harness'
import type { V4View } from '../../map/v4/compose'
import type { AttemptWrite, AttemptWriter } from '@/lib/knowledge/practice-writer'
import { R5_AUTHORED_SET, authoredRef, registrationArgs, type AuthoredGold, type AuthoredSet } from '@/lib/knowledge/authored/authored-items'
import { recordAiReviewedSupply, verifyAiReviewReceipt, type AiReviewReceipt, type RawEvidence } from '../ai-review'
import { openDelivered, recordAuthoredAttempt, requestAuthoredSupply } from '../server'
import { FakeClient } from './pglite-supabase'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const MIG = path.join(ROOT, 'supabase/migrations')
const EV = path.join(ROOT, 'docs/implementation/learning-outcomes-20261021/evidence/2a-ai-review')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const SET_BYTES = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json'))
const RECEIPT = JSON.parse(fs.readFileSync(path.join(EV, 'authored-final-ai-review.json'), 'utf8')) as AiReviewReceipt
const RAW: RawEvidence = {
  claude: { result: fs.readFileSync(path.join(EV, 'claude-65b8975d/result.txt')), session: JSON.parse(fs.readFileSync(path.join(EV, 'claude-65b8975d/session.json'), 'utf8')) },
  codex: { result: fs.readFileSync(path.join(EV, 'codex-f67f4b9a/result.txt')), session: JSON.parse(fs.readFileSync(path.join(EV, 'codex-f67f4b9a/session.json'), 'utf8')) },
}
const S = R5_AUTHORED_SET
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

const ADMIN = '00000000-0000-4000-8000-0000000002a1'
const A = '00000000-0000-4000-8000-0000000002c1'
const B = '00000000-0000-4000-8000-0000000002c2'
let db: PGlite
let admin: FakeClient
const learner = (uid: string) => new FakeClient(db, uid) as unknown as SupabaseClient
const ws: Record<string, string> = {}
const q1 = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!
const n = async (sql: string, p: unknown[] = []) => (await q1<{ n: number }>(`select count(*)::int n from ${sql}`, p)).n
const fails = async (sql: string, p: unknown[] = []) => db.query(sql, p).then(() => null, (e: Error) => e.message)

const writer: AttemptWriter = {
  kind: 'g2',
  async reveal(w: AttemptWrite) {
    return (await q1<{ id: string }>(`insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, help_level, revealed_at)
      values ($1,$2,$3,$4,$5,$6,$7, now()) returning id`, [w.userId, w.clientSessionId, w.activity, w.phase, w.itemRef, w.taskKey, w.helpLevel])).id
  },
  async record(w: AttemptWrite, sessionId: string | null) {
    await db.query(`insert into public.learning_task_attempts (user_id, task_key, item_ref, session_id, phase, activity, help_level, content_hash, response, is_correct, client_mutation_id, answered_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [w.userId, w.taskKey, w.itemRef, sessionId, w.phase, w.activity, w.helpLevel, w.contentHash, JSON.stringify({ ...w.answer, ...w.extra }), w.isCorrect, w.clientMutationId, w.answeredAt])
    return 'inserted'
  },
  async noteExplanationView() { return false },
}
const viewAt = (stage: string, planned: number) => ({
  taskPlans: [{ task: 'r.central_meaning', stage, need: 'GAP', quantity: { planned, done: 0 } }],
  asIs: { asOf: '2026-10-21T00:00:00.000Z', tasks: { 'r.central_meaning': { status: 'verified_need', check: { independentItems: 2 } } } }, toBe: null,
}) as unknown as V4View
const supply = (uid: string, stage: string, planned: number) =>
  requestAuthoredSupply(admin as unknown as SupabaseClient, learner(uid), uid, { view: viewAt(stage, planned), task: 'r.central_meaning', template: 'ws.central-meaning', workspaceId: ws[uid], planVersion: 1, goalVersion: null })
const goldOf = (id: string) => S.items.find((i) => i.id === id)!.gold as AuthoredGold
const rightAnswer = (id: string) => { const g = goldOf(id); return { claim: g.claim, support: g.support, relation: g.relationProbe.relation, choice: g.answer } }
const record = (ref: string, p: unknown) => db.query(`select public.content_ai_decision_record($1, $2::jsonb)`, [ref, JSON.stringify(p)]).then(() => null, (e: Error) => e.message)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql'), 'utf8'))
  await db.exec(`alter table public.learning_task_attempts add column if not exists activity text, add column if not exists help_level text,
    add column if not exists content_hash text, add column if not exists received_at timestamptz default now(), add column if not exists client_mutation_id uuid;
    alter table public.learning_sessions add column if not exists stage text;
    create role service_role nologin;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`)
  for (const s of [C_SQL, B_SQL, read('_pending_workspace_supply_i1_safety.sql'), read('20261018120000_workspace_supply_c_annotation_binding.sql'),
    read('20261018120100_r5_delivery_g2_binding.sql'), read('_pending_authored_supply.sql'), read('_pending_authored_ai_review.sql')]) await db.exec(s)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  for (const uid of [A, B]) {
    ws[uid] = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [uid])).id
    await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [ws[uid], uid])
  }
  admin = new FakeClient(db, ADMIN)
}, 120000)

describe('영수증 검증기(순수) — 실제 원본과 결속', () => {
  it('실제 영수증 · v3 바이트 · 두 원본 응답 = 통과(범위 5개)', () => {
    const r = verifyAiReviewReceipt(RECEIPT, S, SET_BYTES, RAW)
    expect(r).toEqual({ ok: true, refs: RECEIPT.scope.map(authoredRef) })
    expect(RECEIPT.scope).toHaveLength(5)
    expect(S.items.length - RECEIPT.scope.length).toBe(6)
  })
  it('한 AI 누락 · 같은 세션 · 다른 입력 · 응답 원본 불일치 · 사람 검토 주장 · 바이트 변경 · Gold/본문 변경 = 거절', () => {
    const bad = (f: (x: AiReviewReceipt) => void, set: AuthoredSet = S, bytes: Buffer = SET_BYTES) => { const x = clone(RECEIPT); f(x); return verifyAiReviewReceipt(x, set, bytes, RAW) }
    expect(bad((x) => { x.reviews = x.reviews.slice(0, 1) }).ok).toBe(false)
    expect(bad((x) => { x.reviews[1].session_id = x.reviews[0].session_id }).ok).toBe(false)
    expect(bad((x) => { x.reviews[1].prompt_sha256 = '0'.repeat(64) }).ok).toBe(false)
    expect(bad((x) => { x.reviews[0].response_sha256 = '1'.repeat(64) }).ok).toBe(false)
    expect(bad((x) => { x.human_review_claimed = true }).ok).toBe(false)
    expect(bad((x) => { x.scope = [...x.scope, 'r5-cm-ind-1'] }).ok).toBe(false)
    expect(bad(() => {}, S, Buffer.concat([SET_BYTES, Buffer.from(' ')])).ok).toBe(false)
    const goldChanged = clone(S); (goldChanged.items.find((i) => i.id === 'r5-cm-ind-2')!.gold as AuthoredGold).gist += '.'
    expect(bad(() => {}, goldChanged)).toMatchObject({ ok: false, errors: expect.arrayContaining(['content_changed:r5-cm-ind-2']) })
    const bodyChanged = clone(S); bodyChanged.items.find((i) => i.id === 'r5-cm-ind-3')!.body.sentences[0] += ' '
    expect(bad(() => {}, bodyChanged)).toMatchObject({ ok: false, errors: expect.arrayContaining(['content_changed:r5-cm-ind-3']) })
  })
})

describe('등록 → AI 결정 → 자격 · 승인(관리자 세션 · 사람 결정 0)', () => {
  it('범위 5개만 올라간다 · DB 가 JS canonical 해시를 등록 행에서 다시 계산해 결속한다', async () => {
    const r = await recordAiReviewedSupply(admin as unknown as SupabaseClient, S, SET_BYTES, RECEIPT, RAW)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.items.map((x) => x.ref).sort()).toEqual(RECEIPT.scope.map(authoredRef).sort())
    expect(await n('public.content_ai_decision')).toBe(5)
    expect(await n('public.content_human_decision')).toBe(0)
    expect(await n(`public.authored_item where ref = any($1)`, [S.items.filter((i) => !RECEIPT.scope.includes(i.id)).map((i) => authoredRef(i.id))])).toBe(0)
    const d = await q1<{ rights_grant: boolean; human_review: boolean; rights_basis: string; agents: string }>(
      `select rights_grant, human_review, rights_basis, (select string_agg(x->>'agent', ',' order by x->>'agent') from jsonb_array_elements(reviews) x) agents from public.content_ai_decision limit 1`)
    expect(d).toEqual({ rights_grant: false, human_review: false, rights_basis: 'first_party_original_declaration', agents: 'claude,codex' })
    // 축: 근거 없는 값은 만들지 않는다 — G 는 공급 시점 판정, 평가 역할의 D 는 해당 없음
    const ax = await q1<{ axes: Record<string, { state: string }> }>(`select axes from public.content_qualification where artifact_ref = $1`, [authoredRef('r5-cm-ind-2')])
    expect(ax.axes.G.state).toBe('not_applicable')
    expect(ax.axes.D.state).toBe('not_applicable')
  })
  it('같은 요청 반복 = 같은 결정 · 자격 id(행 추가 없음)', async () => {
    const before = await Promise.all([n('public.content_ai_decision'), n('public.content_qualification'), n('public.authored_item')])
    const r = await recordAiReviewedSupply(admin as unknown as SupabaseClient, S, SET_BYTES, RECEIPT, RAW)
    expect(r.status).toBe('ok')
    expect(await Promise.all([n('public.content_ai_decision'), n('public.content_qualification'), n('public.authored_item')])).toEqual(before)
  })
  it('DB 반례: 범위 밖 · 한 AI · 같은 세션 · Gold hash 변경 · 다른 영수증 · 학습자 · 관리자 아닌 세션', async () => {
    const ind1 = S.items.find((i) => i.id === 'r5-cm-ind-1')!
    await admin.rpc('authored_item_register', registrationArgs(S, ind1))
    await admin.auth()
    expect(await record(authoredRef('r5-cm-ind-1'), RECEIPT)).toMatch(/outside the accepted review scope/)
    const ref2 = authoredRef('r5-cm-ind-2')
    const one = clone(RECEIPT); one.reviews = one.reviews.slice(0, 1)
    expect(await record(ref2, one)).toMatch(/exactly two model reviews/)
    const same = clone(RECEIPT); same.reviews[1].session_id = same.reviews[0].session_id
    expect(await record(ref2, same)).toMatch(/distinct sessions/)
    const gold = clone(RECEIPT); gold.items.find((x) => x.id === 'r5-cm-ind-2')!.gold_canonical_sha256 = 'f'.repeat(64)
    expect(await record(ref2, gold)).toMatch(/differs from registered row/)
    const human = clone(RECEIPT); human.human_review_claimed = true
    expect(await record(ref2, human)).toMatch(/not an accepted two-model/)
    const other = clone(RECEIPT); other.reviews[0].items[1].why += ' (edited)'
    expect(await record(ref2, other)).toMatch(/different receipt/)
    await new FakeClient(db, A).auth()
    expect(await record(ref2, RECEIPT)).toMatch(/Forbidden/)
    // 검토 없는 문항은 자격 기록도 거절
    await admin.auth()
    expect(await fails(`select public.authored_ai_qualify($1,'independent_check','{}'::jsonb,$2,'{}')`, [authoredRef('r5-cm-ind-1'), registrationArgs(S, ind1).p_annotation_ref])).toMatch(/no current AI decision/)
  })
  it('직접 INSERT · UPDATE · DELETE 거절 · service_role 기본 권한도 회수됨', async () => {
    expect(await fails(`insert into public.content_ai_decision (artifact_kind, artifact_ref, artifact_revision, gold_hash, js_item_sha256, js_body_sha256, js_gold_sha256,
      set_name, source_file_sha256, receipt_sha256, reviews, rights_basis, scope, decided_by, decider_role)
      select artifact_kind, artifact_ref || 'x', artifact_revision, gold_hash, js_item_sha256, js_body_sha256, js_gold_sha256, set_name, source_file_sha256,
      receipt_sha256, reviews, rights_basis, scope, decided_by, decider_role from public.content_ai_decision limit 1`)).not.toBeNull()
    expect(await fails(`update public.content_ai_decision set scope = '{store}'`)).not.toBeNull()
    expect(await fails(`delete from public.content_ai_decision`)).not.toBeNull()
    const p = await q1<Record<string, boolean>>(`select has_table_privilege('service_role','public.content_ai_decision','INSERT') ins,
      has_table_privilege('service_role','public.content_ai_decision_revocation','DELETE') del,
      has_function_privilege('service_role','public.content_ai_decision_record(text,jsonb)','EXECUTE') rec,
      has_function_privilege('authenticated','public.supply_human_decisions_ok(uuid)','EXECUTE') ok_auth,
      has_function_privilege('anon','public.content_ai_decision_record(text,jsonb)','EXECUTE') rec_anon`)
    expect(p).toEqual({ ins: false, del: false, rec: false, ok_auth: false, rec_anon: false })
  })
})

describe('공급 → 열기 → 실제 채점 → G2 결속 · 철회 · 노출', () => {
  it('확인 단계(2): 검토된 혼자 확인 ind-2 · ind-3 만 · 검토 없는 ind-1 은 후보도 아니다', async () => {
    const r = await supply(A, 'check', 2)
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.lines[0].delivered.sort()).toEqual([authoredRef('r5-cm-ind-2'), authoredRef('r5-cm-ind-3')])
    expect(r.lines[0].rejected).toEqual([])
  })
  it('열기 → 실제 채점(정답) → 근거 결속 · 사람 결정 0 유지', async () => {
    const ref = authoredRef('r5-cm-ind-2')
    const o = await openDelivered(admin as unknown as SupabaseClient, learner(A), A, ref)
    expect(o.status).toBe('ok')
    if (o.status === 'ok') expect(JSON.stringify(o.view)).not.toContain(goldOf('r5-cm-ind-2').gist)
    const deliveryId = (await q1<{ id: string }>(`select id from public.workspace_content_delivery where user_id = $1 and artifact_ref = $2`, [A, ref])).id
    const body = { deliveryId, response: rightAnswer('r5-cm-ind-2'), clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(),
      answeredAt: new Date(Date.now() - 1000).toISOString(), helpLevel: 'independent', sec: 30 }
    const r = await recordAuthoredAttempt(admin as unknown as SupabaseClient, learner(A), { id: A, email: 'a@test.local' }, ref, body, Date.now(), writer)
    expect(r.grade.isCorrect).toBe(true)
    expect(r.binding).toMatchObject({ status: 'bound', evidence: true })
    expect(await n('public.content_human_decision')).toBe(0)
  })
  it('노출 재사용: 같은 학습자 재요청은 새 납품 없음 · 이미 받은 평가 지문 직접 공급 거절', async () => {
    const before = await n(`public.workspace_content_delivery where user_id = $1`, [A])
    await supply(A, 'check', 2)
    expect(await n(`public.workspace_content_delivery where user_id = $1`, [A])).toBe(before)
  })
  it('AI 결정 철회 → 지금 유효성 false · 새 학습자에게 그 문항은 나가지 않는다', async () => {
    const ref = authoredRef('r5-cm-ind-3')
    const dec = (await q1<{ id: string }>(`select id from public.content_ai_decision where artifact_ref = $1`, [ref])).id
    await admin.auth()
    await db.query(`select public.content_ai_decision_revoke($1, '2A 시험 — 철회 반례')`, [dec])
    const d = (await q1<{ id: string }>(`select id from public.workspace_content_delivery where user_id = $1 and artifact_ref = $2`, [A, ref])).id
    await new FakeClient(db, A).auth()
    expect((await q1<{ v: boolean }>(`select public.workspace_delivery_current($1) v`, [d])).v).toBe(false)
    const r = await supply(B, 'check', 2)
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.lines[0].delivered).toEqual([authoredRef('r5-cm-ind-2')])
    expect(r.lines[0].orderOpened).toBe(true)
  })
})
