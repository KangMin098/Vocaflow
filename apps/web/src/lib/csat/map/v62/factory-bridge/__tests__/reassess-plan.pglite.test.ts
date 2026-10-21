// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts
//
// 2C — 결합 설치 한 PGlite DB 에서: 실제 목표 · 계획 저장 구조(20261010180218 + 181834, 시험 사본이 아닌 정본 SQL) → C/B/I1/G2/D3/grade →
//   authored 공급 → AI 검토 overlay → 1C → 1D → 2B. 그 위에서 원문 안내 연습 · 설명 저장 → 다시 열기 복원(새 채점 · INSERT 없음) →
//   실제 2A AI 검토 5문항 등록(사람 결정 0) → 같은 Workspace · 같은 학습자에게 미노출 혼자 확인 2개 공급 → 실제 채점 · learning_task_attempts · G2 →
//   기존 asIsMap → toBeMap → planWorkspaces → workspacePlan → buildCommitPayload → learner_workspace_plan_commit 으로 check_result 새 계획 버전 저장.
// 대역(명시): loadMapPage 의 도메인 입력(시험 회차 · 축 대리 · 기준 문항 · 확인 링크)은 authored-flow 와 같은 합성값으로 world() 가 만든다.
//   route.ts 의 POST 순서는 postPlan() 이 같은 함수로 따라 한다 — findCommitByKey 는 PostgREST 임베드라 SQL 로 같은 PriorCommit 을 읽는다.
//   결과 근거(G2) · 계획 저장(RPC) 은 대역이 아니다. 긍정/부정 응답은 Gold 로 만든 합성 회귀이며 AI 학습자 관측이 아니다.
// ⚠️ PGlite = 슈퍼유저 · 단일 연결 — 실제 RLS · 두 연결 동시성은 NOT_RUN.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { canonicalJson } from '../../canonical-json'
import type { WorkspaceDemand } from '../../demand'
import { canonicalDemand } from '../../persist-contract'
import { B_SQL, C_SQL, STUB, as } from '../../__tests__/supply-sql-harness'
import { openFactoryDelivery, submitFactoryAttempt } from '../dcp-learning'
import { lessonProgress, savedReflection, submitReflection, type ReflectionBody, type ReflectionReader } from '../source-lesson'
import { admitCandidates, approveForGuidedPractice, d3Linker, receiveForLearner, type SourceReader } from '../dcp-supply'
import type { ProductionOutput, ProductionPacket } from '../local-production'
import { fileSha, outputOf, packetOf, prepared, reviewOf, row } from './dcp-fixture'
import type { V4View } from '../../../v4/compose'
import { asIsMap } from '../../../v4/as-is'
import { DOMAINS, templateOf } from '../../../v4/definition'
import { workspacePlan, type PlanActivity, type WorkspacePlanView } from '../../../v4/plan'
import { buildCommitPayload, parseCommitRequest, sameCommitRequest, type PlanCommitRequest, type PriorCommit } from '../../../v4/plan-commit'
import { commitPlan, loadSavedPlans, setGoal, storeStatus } from '../../../v4/plan-store'
import { toBeMap } from '../../../v4/to-be'
import { planWorkspaces } from '../../../v4/workspace'
import { recordAiReviewedSupply, type AiReviewReceipt, type RawEvidence } from '@/lib/csat/authored/ai-review'
import { applyAuthoredBindings } from '@/lib/csat/authored/evidence'
import { recordAuthoredAttempt, requestAuthoredSupply } from '@/lib/csat/authored/server'
import { FakeClient } from '@/lib/csat/authored/__tests__/pglite-supabase'
import { R5_AUTHORED_SET, authoredRef } from '@/lib/knowledge/authored/authored-items'
import type { AttemptWrite, AttemptWriter } from '@/lib/knowledge/practice-writer'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { wrongResponse } from '@/lib/knowledge/__tests__/authored-responses'

const ROOT = path.resolve(__dirname, '../../../../../../../../..')
const MIG = path.join(ROOT, 'supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const EV = path.join(ROOT, 'docs/implementation/learning-outcomes-20261021/evidence/2a-ai-review')
const SET_BYTES = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json'))
const RECEIPT = JSON.parse(fs.readFileSync(path.join(EV, 'authored-final-ai-review.json'), 'utf8')) as AiReviewReceipt
const RAW: RawEvidence = {
  claude: { result: fs.readFileSync(path.join(EV, 'claude-65b8975d/result.txt')), session: JSON.parse(fs.readFileSync(path.join(EV, 'claude-65b8975d/session.json'), 'utf8')) },
  codex: { result: fs.readFileSync(path.join(EV, 'codex-f67f4b9a/result.txt')), session: JSON.parse(fs.readFileSync(path.join(EV, 'codex-f67f4b9a/session.json'), 'utf8')) },
}
const I1_STUB = fs.readFileSync(path.resolve(__dirname, '../../__tests__/supply-i1-stub.sql'), 'utf8')
const GRADE_SQL = (() => {
  const s = read('20260920120000_grade_dcp_band_is_fit_not_eligibility.sql')
  const a = s.indexOf('CREATE OR REPLACE FUNCTION public.grade_dcp_item')
  const b = s.indexOf('END $function$;', a)
  if (a < 0 || b < 0) throw new Error('grade_dcp_item definition not found')
  return s.slice(a, b + 'END $function$;'.length)
})()
// 시험 사본의 목표 · Workspace · 계획 표를 빼고 정본 마이그레이션으로 만든다
const BASE = (() => {
  const a = STUB.indexOf('create table public.csat_map_goal_version')
  const b = STUB.indexOf('create table public.csat_dcp_items')
  if (a < 0 || b < a) throw new Error('stub layout changed')
  return STUB.slice(0, a) + STUB.slice(b)
})()
const PRE = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now(),
  add column if not exists client_mutation_id uuid;
  alter table public.learning_sessions add column if not exists stage text;
  alter table public.learning_sessions add constraint ls_cs unique (user_id, client_session_id);
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
    constraint funnel_events_event_check check (event = any (array['screen_viewed', 'csat_map_viewed']::text[])));
  create table public.csat_map_goal (user_id uuid primary key references auth.users(id), target_score smallint not null, updated_at timestamptz not null default now());`

const ADMIN = '00000000-0000-4000-8000-0000000003a1'
const A = '00000000-0000-4000-8000-0000000003b1'
const B = '00000000-0000-4000-8000-0000000003b2'
const TASK = 'r.central_meaning'
const TEMPLATE = 'ws.central-meaning'
const KEY = 'authored-central-meaning'
const S = R5_AUTHORED_SET
let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let packet: ProductionPacket
let output: ProductionOutput
const q1 = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!
const count = async (sql: string, p: unknown[] = []) => (await q1<{ n: number }>(`select count(*)::int n from ${sql}`, p)).n
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** 1D/2B 서비스용(SupplyClient) + 2C 복원 읽기용(from) — 같은 학습자 세션 */
const client = (uid: string | null): ReflectionReader => ({
  async rpc<T>(fn: string, args: Record<string, unknown>) {
    await as(db, uid)
    const keys = Object.keys(args)
    const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v })
    try {
      const r = await db.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) r`, vals)
      return { data: r.rows[0]!.r, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }
    }
  },
  from: ((t: string) => new FakeClient(db, uid).from(t)) as unknown as ReflectionReader['from'],
})
/** 계획 저장소(plan-store) 가 쓰는 service 클라이언트 — 표를 돌려주는 RPC 는 select * from 으로 부른다 */
const planDb = (): SupabaseClient => {
  const fc = new FakeClient(db, null)
  return {
    from: (t: string) => fc.from(t),
    async rpc(fn: string, args: Record<string, unknown>) {
      if (fn !== 'learner_workspace_plan_commit') return fc.rpc(fn, args)
      const keys = Object.keys(args)
      const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v })
      try {
        return { data: (await db.query(`select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, vals)).rows, error: null }
      } catch (e) {
        return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }
      }
    },
  } as unknown as SupabaseClient
}
const admin = client(ADMIN)
const learnerA = client(A)
const fcAdmin = () => new FakeClient(db, ADMIN) as unknown as SupabaseClient
const fcLearner = (uid: string) => new FakeClient(db, uid) as unknown as SupabaseClient
const reader: SourceReader = async (id) => {
  const r = (await db.query<{ content: string; row: Record<string, unknown> }>(`select content, row from public.library_articles where id = $1`, [id])).rows[0]
  return r ? { snapshot_kind: 'read_only_database_export', current_time: '2026-10-21T07:00:00Z', row: { ...r.row, content: r.content } } : null
}

/** 서버 G2 쓰기 어댑터의 시험 사본(authored-flow 와 같다) */
const writer: AttemptWriter = {
  kind: 'g2',
  async reveal(w: AttemptWrite) {
    const r = await q1<{ id: string }>(`insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, help_level, revealed_at)
      values ($1,$2,$3,$4,$5,$6,$7, now()) on conflict do nothing returning id`, [w.userId, w.clientSessionId, w.activity, w.phase, w.itemRef, w.taskKey, w.helpLevel]).catch(() => null)
    if (r?.id) return r.id
    return (await q1<{ id: string }>(`select id from public.learning_sessions where user_id = $1 and client_session_id = $2`, [w.userId, w.clientSessionId])).id
  },
  async record(w: AttemptWrite, sessionId: string | null) {
    const prev = await db.query(`select 1 from public.learning_task_attempts where user_id = $1 and client_mutation_id = $2`, [w.userId, w.clientMutationId])
    if (prev.rows.length) return 'duplicate'
    await db.query(`insert into public.learning_task_attempts (user_id, task_key, item_ref, session_id, phase, activity, help_level, content_hash, response, is_correct, client_mutation_id, answered_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [w.userId, w.taskKey, w.itemRef, sessionId, w.phase, w.activity, w.helpLevel, w.contentHash, JSON.stringify({ ...w.answer, ...w.extra }), w.isCorrect, w.clientMutationId, w.answeredAt])
    return 'inserted'
  },
  async noteExplanationView() { return false },
}

/** 지도 계산 — authored-flow world() 와 같은 기존 함수 사슬(도메인 입력은 합성 대역). 창작 납품만 확인 · 바로잡기 링크로 쓴다 */
async function world(uid: string): Promise<{ view: WorkspacePlanView; v4: V4View; status: string }> {
  const attempts = (await db.query<Row>(`select a.*, b.evidence, b.annotation_hash, d.role from learning_task_attempts a left join workspace_delivery_attempt b on b.attempt_id = a.id
    left join workspace_content_delivery d on d.id = b.delivery_id where a.user_id = $1 order by a.answered_at, a.id`, [uid])).rows
  const iso = (t: unknown) => (t ? new Date(t as string).toISOString() : null)
  const raw = attempts.map((a) => ({ userId: uid, attemptId: String(a.id), itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, isCorrect: a.is_correct, synthetic: false, helpLevel: a.help_level,
    afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: iso(a.answered_at), activity: a.activity, sessionId: a.session_id, contentHash: a.content_hash, expectedContentHash: null })) as unknown as FindAttemptRow[]
  const bound = applyAuthoredBindings(raw, attempts.filter((a) => a.annotation_hash).map((a) => ({ attemptId: String(a.id), evidence: a.evidence, annotationHash: a.annotation_hash, sessionId: a.session_id })))
  const deliveries = (await db.query<Row>(`select * from workspace_content_delivery where user_id = $1 and artifact_ref like 'authored:%' order by delivered_at`, [uid])).rows
  const check = deliveries.filter((d) => d.role === 'independent_check')
  const asOf = new Date(Math.max(Date.now(), ...attempts.map((a) => new Date(a.answered_at).getTime())) + 1000).toISOString()
  const map = asIsMap({ asOf, sessions: [{ id: 'synthetic-exam-record', examId: 'E', examLabel: 'Synthetic', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }],
    axisProxy: { state: Object.fromEntries(DOMAINS.map((d) => [d, 'check_first'])), contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) } as never, checks: [{ taskKey: KEY, items: check.map((d) => d.artifact_ref) }], attempts: bound })
  const link = (d: Row) => ({ target: d.artifact_ref, href: '/csat/learn/' + d.artifact_ref.slice(9) + '?d=' + d.id, label: d.role })
  const links = { [KEY]: check.map(link) }
  const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
  const goal = toBeMap({ asIs: map, goal: { score: 80, set: true }, refItems: refs as never, lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) } as never, confirmLinks: links as never })
  const repair = { [KEY]: deliveries.filter((d) => ['guided_practice', 'model_explanation'].includes(d.role)).map((d) => ({ ...link(d), role: d.role })) }
  const transfers = { [KEY]: deliveries.filter((d) => d.role === 'transfer').map(link) }
  const homes = planWorkspaces({ asIs: map, toBe: goal, confirmLinks: links as never, repairTargets: repair as never, transferTargets: transfers as never, transferItems: { [KEY]: transfers[KEY].length } })
  const home = [homes.primary, ...homes.others].find((x) => x?.id === TEMPLATE)!
  const activity = attempts.map((a) => ({ itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, activity: a.activity, isCorrect: a.is_correct, answeredAt: iso(a.answered_at), receivedAt: iso(a.received_at),
    ...(a.role === 'guided_practice' ? { repairRole: 'guided_practice' as const } : {}) })) as PlanActivity[]
  const view = workspacePlan(home, map, goal, homes, activity)
  return { view, v4: { asIs: map, toBe: goal, taskPlans: view.tasks } as unknown as V4View, status: String(map.tasks[TASK as never]?.status) }
}

/** route.ts POST 의 순서 그대로(인증 · loadMapPage 만 대역): 재시도 키 → 목표 버전 → 계산 → 페이로드 → 저장 → 저장 행 재확인 */
async function priorOf(uid: string, clientKey: string): Promise<PriorCommit | null> {
  const r = (await db.query<Row>(`select p.workspace_id, p.plan_version, p.plan, p.reason, p.note, p.restored_from, p.goal_version_id, w.template_id from public.learner_workspace_plan p
    join public.learner_workspace w on w.id = p.workspace_id where p.user_id = $1 and p.client_key = $2`, [uid, clientKey])).rows[0]
  return r ? { template: r.template_id, version: r.plan_version, workspaceId: r.workspace_id, plan: r.plan, reason: r.reason, note: r.note, restoredFrom: r.restored_from, goalVersionId: r.goal_version_id == null ? null : Number(r.goal_version_id) } : null
}
async function postPlan(uid: string, body: unknown): Promise<{ status: number; body: Row }> {
  const parsed = parseCommitRequest(body)
  if (!parsed.ok) return { status: 400, body: { code: parsed.code } }
  const pdb = planDb()
  if ((await storeStatus(pdb)) === 'not_installed') return { status: 503, body: { code: 'not_installed' } }
  const prior = await priorOf(uid, parsed.req.clientKey)
  if (prior) return sameCommitRequest(prior, parsed.req) ? { status: 200, body: { version: prior.version, reused: true, workspaceId: prior.workspaceId } } : { status: 409, body: { code: 'client_key_reused' } }
  const saved0 = await loadSavedPlans(pdb, uid)
  const calculatedGoalVersion = saved0.goalVersionId
  if (parsed.req.expectedGoalVersion !== undefined && parsed.req.expectedGoalVersion !== calculatedGoalVersion) return { status: 409, body: { code: 'goal_changed' } }
  const w = await world(uid)
  const r = parsed.req
  const built = buildCommitPayload(r, w.view, w.v4.asIs.asOf)
  if (!built.ok) return { status: built.status, body: { code: built.code, detail: built.detail } }
  const res = await commitPlan(pdb, { userId: uid, template: r.template, templateTasks: built.templateTasks, canon: built.canon, plan: built.plan, reason: r.reason, note: r.note ?? null,
    asOf: built.asOf, goalVersionId: calculatedGoalVersion, expectedVersion: r.expectedVersion, clientKey: r.clientKey, restoreOf: null })
  if (!res.ok) return { status: res.status, body: { code: res.code } }
  const committed = await priorOf(uid, r.clientKey)
  if (!committed || committed.version !== res.version || committed.workspaceId !== res.workspaceId) throw new Error('commit not confirmed')
  if (!sameCommitRequest(committed, r)) return { status: 409, body: { code: 'client_key_reused' } }
  return { status: 200, body: { version: res.version, reused: res.reused, workspaceId: res.workspaceId } }
}
const tpl = templateOf(TEMPLATE)!
const ORDER = [...tpl.core, ...tpl.support]
const request = (o: Partial<PlanCommitRequest>): PlanCommitRequest => ({ template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 1, clientKey: key(), ...o }) as PlanCommitRequest

let goal1 = 0
let wsA = ''
const lessonDel: Record<string, { delivery: string; answer: number }> = {}
const bodyOf = (step: ReflectionBody['step']): ReflectionBody => ({
  step, claim: step === 'title' ? null : 6, support: step === 'title' ? [8] : step === 'topic' ? [1, 5] : [3], relation: '설명이 판단을 받친다고 보았다.',
  comparison: step === 'main_point' ? '나는 사례에 머물렀고 시범은 사례 너머의 기능을 찾았다.' : null, procedure: step === 'topic' ? '사례와 설명을 가르고 판단으로 압축한다.' : null,
})
const dOf = async (uid: string, ref: string) => (await q1<{ id: string }>(`select id from public.workspace_content_delivery where user_id = $1 and artifact_ref = $2`, [uid, ref])).id

beforeAll(async () => {
  db = new PGlite()
  await db.exec(BASE)
  await db.exec(I1_STUB)
  await db.exec(PRE)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`)
  for (const s of [read('20261010180218_map_v4_plan.sql'), read('20261010181834_map_v4_plan_conflict_code.sql'),
    C_SQL, B_SQL, read('_pending_workspace_supply_i1_safety.sql'), read('_pending_workspace_supply_i1_partial.sql'),
    read('20261018120000_workspace_supply_c_annotation_binding.sql'), read('20261018120100_r5_delivery_g2_binding.sql'),
    read('20261020063000_factory_product_order_lineage_v1.sql'), GRADE_SQL, read('_pending_authored_supply.sql'),
    read('_pending_authored_ai_review.sql'), read('_pending_factory_dcp_admission.sql'), read('_pending_factory_dcp_learning.sql')]) await db.exec(s)
  await db.exec(`alter default privileges in schema public grant execute on functions to anon, authenticated, service_role`)
  await db.exec(read('_pending_source_lesson_reflection.sql'))
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  packet = await packetOf(false)
  output = outputOf(packet)
  const { content, ...rest } = row()
  await db.query(`insert into public.library_articles (id, content, row) values ($1, $2, $3::jsonb)`, [packet.body.source.id, content, JSON.stringify(rest)])
  const prep = await prepared()
  await db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, canonical_order, spec, spec_hash, quantity, reason, registered_by, request_key)
    values ($1, $2, $3, $4, $5::jsonb, encode(sha256(convert_to(public.factory_lineage_canonical($5::jsonb), 'UTF8')), 'hex'), 3, 'isolated 2C', $6, $7)`,
  [packet.body.order.product_order_id, packet.body.order.order_revision, packet.body.order.order_hash,
    canonicalJson((prep as unknown as { factory: { order: unknown } }).factory.order), JSON.stringify({ ...packet.body.spec, schema: 'vf.factory-lineage-spec/1' }), ADMIN, key()])
}, 240000)

describe('2C-1 · 실제 목표 · 첫 계획(정본 SQL)', () => {
  it('목표 RPC → 첫 계획 initial v1 — Workspace 는 계획 RPC 가 만든다', async () => {
    expect((await q1<{ f: string | null }>(`select to_regprocedure('public.learner_workspace_plan_commit(uuid,text,text[],text,jsonb,text,text,timestamptz,bigint,integer,uuid,integer)')::text f`)).f).not.toBeNull()
    const g = await setGoal(planDb(), A, 80, key())
    expect(g.mode).toBe('versioned')
    goal1 = g.goalVersionId!
    const r = await postPlan(A, request({ reason: 'initial', expectedVersion: 0, expectedGoalVersion: goal1 }))
    expect(r).toMatchObject({ status: 200, body: { version: 1, reused: false } })
    wsA = r.body.workspaceId
    expect(await q1(`select plan_version, reason, goal_version_id::int g from public.learner_workspace_plan where workspace_id = $1`, [wsA])).toEqual({ plan_version: 1, reason: 'initial', g: goal1 })
  })
})

describe('2C-2 · 원문 안내 연습 → 설명 저장 → 다시 열기 복원', () => {
  it('같은 Workspace 의 개인 주문으로 세 단계 납품 · 세 설명 저장', async () => {
    const spec = packet.body.spec as unknown as { definition: string; types: string[]; keys: string[]; requires: Record<string, unknown> }
    const d = { key: 'k', template: TEMPLATE, workspaceId: wsA, goalVersion: goal1, planVersion: 1, definitionVersion: spec.definition, asOf: '2026-10-21T00:00:00Z', core: TASK, support: [],
      purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
      lines: [{ role: 'guided_practice', task: TASK, quantity: { n: 10 }, csatTypes: spec.types, taskKeys: spec.keys, requires: spec.requires, reason: '2c-lesson' }] } as unknown as WorkspaceDemand
    await as(db, A)
    const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(A, d)])).id
    const line = (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
    const signatureOf = async (order: string) => (await db.query<{ s: string }>(`select d.signature s from public.factory_order o join public.workspace_content_demand_line l on l.id = o.line_id
      join public.workspace_content_demand d on d.id = l.demand_id where o.id = $1`, [order])).rows[0]?.s ?? null
    const product = { product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision, order_hash: packet.body.order.order_hash }
    const r = await admitCandidates(admin, reader, { packet, output, outputSha256: fileSha(output), review: reviewOf(packet, output), rights: { record_id: 'isolated-rights-fixture#cc0', basis: 'isolated_harness_only' } }, { isolated: true })
    if (!r.ok) throw new Error(`${r.code} ${r.detail ?? ''}`)
    let orderId: string | null = null
    for (const it of r.items) {
      const ap = await approveForGuidedPractice(admin, it.qualification_id!, '2C 격리 — AI 검수 기반 후보')
      if (!ap.ok) throw new Error(ap.code)
      const got = await receiveForLearner(learnerA, orderId ? async () => ({ ok: true, link_id: 'existing' }) : d3Linker(client(null), ADMIN, product, signatureOf, { quantity: 3, reason: '2C', requestKey: () => key() }),
        { lineId: line, orderId, quantity: 3, qualificationId: it.qualification_id!, approvalId: ap.data, orderKey: key(), deliveryKey: key() })
      if (!got.ok) throw new Error(`${got.code} ${got.detail}`)
      orderId = got.order_id
      const t = await q1<{ type: string; answer: number }>(`select type, (answer_key->>'answer')::int answer from public.csat_dcp_items where id = $1`, [it.dcp_item_id])
      lessonDel[t.type] = { delivery: got.delivery_id, answer: t.answer }
    }
    for (const step of ['main_point', 'title', 'topic'] as const) {
      const a = await submitFactoryAttempt(learnerA, lessonDel[step]!.delivery, { choice: lessonDel[step]!.answer, mutationId: key() })
      if (!a.ok) throw new Error(a.code)
      const s = await submitReflection(learnerA, a.result.receiptId, { body: bodyOf(step), mutationId: key(), deliveryId: lessonDel[step]!.delivery })
      expect(s.ok, step).toBe(true)
    }
    expect(await count('public.source_lesson_reflection where user_id = $1', [A])).toBe(3)
  })

  it('다시 열기: 저장된 본문 · 형성 피드백 · 다음 단계 복원 — 새 채점 · 새 설명 INSERT 0', async () => {
    const before = await Promise.all([count('public.factory_dcp_attempt'), count('public.csat_item_attempts'), count('public.source_lesson_reflection')])
    const m = await savedReflection(learnerA, A, lessonDel.main_point!.delivery)
    if (!m.ok || !m.saved) throw new Error(JSON.stringify(m))
    expect(m.saved.body).toEqual(bodyOf('main_point'))
    expect(m.saved.feedback.claim).toBe('accepted')
    expect(m.saved.next).toMatchObject({ type: 'title', deliveryId: lessonDel.title!.delivery })
    const t = await savedReflection(learnerA, A, lessonDel.topic!.delivery)
    expect(t.ok && t.saved?.body.procedure).toBe(bodyOf('topic').procedure)
    expect(t.ok && t.saved?.next).toBeNull()
    // 닫힌 DTO — 정답 키 · 시범 문장은 실리지 않는다
    expect(Object.keys(m.saved).sort()).toEqual(['attemptId', 'body', 'feedback', 'next', 'reflectionId', 'step'])
    expect(JSON.stringify(m.saved)).not.toMatch(/answer_key|answerKey|"model"/)
    expect(await Promise.all([count('public.factory_dcp_attempt'), count('public.csat_item_attempts'), count('public.source_lesson_reflection')])).toEqual(before)
  })

  it('다른 학습자 = 복원 없음(not_found) · 설명은 G2/독립 근거가 아니다', async () => {
    expect(await savedReflection(client(B), B, lessonDel.main_point!.delivery)).toEqual({ ok: false, code: 'not_found' })
    expect(await count('public.learning_task_attempts')).toBe(0)
    expect(await count('public.workspace_delivery_attempt')).toBe(0)
  })
})

describe('2C-3 · 같은 Workspace → 검토된 미노출 혼자 확인 2 → 실제 채점 · G2 → 계획 check_result 저장', () => {
  it('AI 검토 5문항 등록(사람 결정 0) → 계산된 계획 보기로 공급 = ind-2 · ind-3 만', async () => {
    const r = await recordAiReviewedSupply(fcAdmin(), S, SET_BYTES, RECEIPT, RAW)
    expect(r.status).toBe('ok')
    expect(await count('public.content_ai_decision')).toBe(5)
    expect(await count('public.content_human_decision')).toBe(0)
    const w = await world(A)
    const row = w.view.tasks.find((t) => t.task === TASK)!
    expect(row.stage, '확인 근거가 없으면 확인 단계').toBe('check')
    const sup = await requestAuthoredSupply(fcAdmin(), fcLearner(A), A, { view: w.v4, task: TASK as never, template: TEMPLATE, workspaceId: wsA, planVersion: 1, goalVersion: goal1 })
    if (sup.status !== 'ok') throw new Error(sup.status)
    const delivered = sup.lines.flatMap((l) => l.delivered).sort()
    expect(delivered).toEqual([authoredRef('r5-cm-ind-2'), authoredRef('r5-cm-ind-3')])
    // 같은 요청 반복 = 새 납품 없음(노출 재사용 없음)
    const n0 = await count(`public.workspace_content_delivery where user_id = $1 and artifact_ref like 'authored:%'`, [A])
    await requestAuthoredSupply(fcAdmin(), fcLearner(A), A, { view: w.v4, task: TASK as never, template: TEMPLATE, workspaceId: wsA, planVersion: 1, goalVersion: goal1 })
    expect(await count(`public.workspace_content_delivery where user_id = $1 and artifact_ref like 'authored:%'`, [A])).toBe(n0)
  })

  it('두 지문 독립 오답(합성 회귀) → G2 근거 2 · 같은 원문 3문항은 독립 확인으로 세지 않음 → 단계 repair', async () => {
    for (const id of ['r5-cm-ind-2', 'r5-cm-ind-3']) {
      const item = S.items.find((i) => i.id === id)!
      const res = await recordAuthoredAttempt(fcAdmin(), fcLearner(A), { id: A, email: null }, authoredRef(id), {
        deliveryId: await dOf(A, authoredRef(id)), response: wrongResponse('central_meaning', item.body as never, item.gold as never),
        clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date(Date.now() - 1000).toISOString(), helpLevel: 'independent', sec: 30 }, Date.now(), writer)
      expect(res.grade.isCorrect).toBe(false)
      expect(res.binding).toMatchObject({ status: 'bound', evidence: true })
    }
    expect((await db.query<{ item_ref: string }>(`select item_ref from public.learning_task_attempts where user_id = $1 order by item_ref`, [A])).rows.map((x) => x.item_ref))
      .toEqual([authoredRef('r5-cm-ind-2'), authoredRef('r5-cm-ind-3')])
    const w = await world(A)
    expect(w.status).toBe('verified_need')
    expect(w.view.tasks.find((t) => t.task === TASK)!.stage).toBe('repair')
  })

  it('check_result 새 계획 v2 가 DB 에 저장된다(현재 goal · plan 기대 버전)', async () => {
    const req = request({ expectedVersion: 1, expectedGoalVersion: goal1 })
    const r = await postPlan(A, req)
    expect(r).toMatchObject({ status: 200, body: { version: 2, reused: false, workspaceId: wsA } })
    const v2 = await q1<Row>(`select plan_version, reason, goal_version_id::int g, plan from public.learner_workspace_plan where workspace_id = $1 and plan_version = 2`, [wsA])
    expect(v2).toMatchObject({ plan_version: 2, reason: 'check_result', g: goal1 })
    expect(v2.plan.tasks.find((t: Row) => t.task === TASK).stage).toBe('repair')
    const v1 = await q1<Row>(`select plan from public.learner_workspace_plan where workspace_id = $1 and plan_version = 1`, [wsA])
    expect(v1.plan.tasks.find((t: Row) => t.task === TASK).stage, 'v1 은 그대로(추가 전용)').toBe('check')
    // 응답 유실 복구 — 같은 키 · 같은 본문 = 같은 v2, 행 증가 없음
    expect(await postPlan(A, req)).toMatchObject({ status: 200, body: { version: 2, reused: true } })
    // 같은 키 · 다른 본문 = 409
    expect(await postPlan(A, { ...req, note: '다른 본문' })).toMatchObject({ status: 409, body: { code: 'client_key_reused' } })
    // 낡은 plan 기대 버전 = conflict
    expect(await postPlan(A, request({ expectedVersion: 1, expectedGoalVersion: goal1 }))).toMatchObject({ status: 409, body: { code: 'conflict' } })
    expect(await count('public.learner_workspace_plan where workspace_id = $1', [wsA])).toBe(2)
  })

  it('낡은 목표 = goal_changed · 새 목표로 v3 · 다른 학습자는 A 의 계획을 못 건드린다', async () => {
    const g2 = (await setGoal(planDb(), A, 85, key())).goalVersionId!
    expect(await postPlan(A, request({ expectedVersion: 2, expectedGoalVersion: goal1 }))).toMatchObject({ status: 409, body: { code: 'goal_changed' } })
    expect(await postPlan(A, request({ reason: 'goal_change', expectedVersion: 2, expectedGoalVersion: g2 }))).toMatchObject({ status: 200, body: { version: 3 } })
    expect(Number((await q1<{ g: number }>(`select goal_version_id g from public.learner_workspace_plan where workspace_id = $1 and plan_version = 3`, [wsA])).g)).toBe(g2)
    // B: 자기 Workspace 가 없다 — A 의 버전을 기대해도 B 의 현재(0)와 충돌
    expect(await postPlan(B, request({ expectedVersion: 3 }))).toMatchObject({ status: 409, body: { code: 'conflict' } })
    expect(await count('public.learner_workspace_plan where user_id = $1', [B])).toBe(0)
    // 추가 전용 — 계획 행은 고칠 수 없다
    await expect(db.query(`update public.learner_workspace_plan set note = 'x' where workspace_id = $1`, [wsA])).rejects.toThrow(/추가 전용/)
  })

  it('새 계획 뒤 구계획에 묶인 원문 연습은 현재 학습 가능으로 보이지 않는다(복원도 진행 단계에서 막힌다)', async () => {
    expect(await openFactoryDelivery(learnerA, lessonDel.main_point!.delivery)).toEqual({ ok: false, code: 'lineage_not_current' })
    const p = await lessonProgress(learnerA, lessonDel.main_point!.delivery)
    expect(p.ok).toBe(false)
    expect((await savedReflection(learnerA, A, lessonDel.main_point!.delivery)).ok).toBe(false)
    // 저장 이력 자체는 보존(삭제 · 수정 없음)
    expect(await count('public.source_lesson_reflection where user_id = $1', [A])).toBe(3)
  })
})
