// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts
//
// 2C — 결합 설치 한 PGlite DB 에서: 실제 목표 · 계획 저장 구조(20261010180218 + 181834, 시험 사본이 아닌 정본 SQL) → C/B/I1/G2/D3/grade →
//   authored 공급 → AI 검토 overlay → 1C → 1D → 2B. 그 위에서 원문 안내 연습 · 설명 저장 → 다시 열기 복원(새 채점 · INSERT 없음) →
//   실제 2A AI 검토 5문항 등록(사람 결정 0) → 같은 Workspace · 같은 학습자에게 미노출 혼자 확인 2개 공급 → 실제 채점 · learning_task_attempts · G2 →
//   실제 composeV4 · nextActionOf → 실제 plan POST → learner_workspace_plan_commit 으로 check_result 새 계획 버전 저장.
// 대역(명시): 인증과 loadMapPage 경계만 주입한다. 시험 회차·축 관찰·기준 문항은 합성 도메인 입력이고,
//   납품·시도·G2·설명 영수증·저장 계획은 같은 SQL DB에서 읽는다. 실제 handler/계산/채점/저장 함수를 대체하지 않는다.
//   최초 오답은 합성 회귀다. 전이·재확인 응답은 신규 Codex 세션 원본(숫자 인덱스 변환만)이며 인과 학습효과 주장이 아니다.
// ⚠️ PGlite = 슈퍼유저 · 단일 연결 — 실제 RLS · 두 연결 동시성은 NOT_RUN.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST as planPOST } from '@/app/api/csat/diagnosis/map/plan/route'
import type { MapPageData } from '../../../load'
import { composeV4 } from '../../../v4/compose'
import { ranksOf } from '../../../v62/rank'
import { nextActionOf } from '../../../v62/next-action'

const routeState = vi.hoisted(() => ({ uid: '', db: null as SupabaseClient | null, load: null as (() => Promise<MapPageData>) | null, learner: null as unknown }))
// 2F — 학습자 세션 클라이언트(createClient) 자리만 같은 SQL DB 의 그 학습자 세션으로 주입한다
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => routeState.learner }))
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ userId: routeState.uid, db: routeState.db }),
  readJson: async (req: Request) => req.json(),
  failure: (error: unknown) => NextResponse.json({ error: String(error) }, { status: 500 }),
}))
vi.mock('@/lib/csat/map/load', () => ({ loadMapPage: async () => routeState.load!() }))

import { canonicalJson } from '../../canonical-json'
import { buildDemand, type WorkspaceDemand } from '../../demand'
import { canonicalDemand } from '../../persist-contract'
import { B_SQL, C_SQL, STUB, as } from '../../__tests__/supply-sql-harness'
import { openFactoryDelivery, submitFactoryAttempt } from '../dcp-learning'
import { lessonProgress, savedReflection, submitReflection, type ReflectionBody, type ReflectionReader } from '../source-lesson'
import { admitCandidates, d3Linker, receiveForLearner, type SourceReader } from '../dcp-supply'
import { approveFactoryDcp } from '../dcp-request'
import { POST as factoryRequestPOST } from '@/app/api/csat/factory/request/route'
import { executeProductOrderLineage } from '@/lib/admin/product-order-lineage'
import type { ProductionOutput, ProductionPacket } from '../local-production'
import { fileSha, outputOf, packetOf, prepared, reviewOf, row, snapshot } from './dcp-fixture'
import { checkKeysOfTask } from '../../../v4/definition'
import type { V4View } from '../../../v4/compose'
import { templateOf } from '../../../v4/definition'
import { repairGate, type PlanActivity, type WorkspacePlanView } from '../../../v4/plan'
import { loadSourceRepairReceipts, parseRepairReceipts, receiptActivity, receiptTargets, type RepairReceipt } from '../../../source-repair-receipt'
import { authoredKeysOf } from '@/lib/knowledge/authored/tasks'
import type { PlanCommitRequest } from '../../../v4/plan-commit'
import { loadSavedPlans, setGoal } from '../../../v4/plan-store'
import { recordAiReviewedSupply, type AiReviewReceipt, type RawEvidence } from '@/lib/csat/authored/ai-review'
import { applyAuthoredBindings } from '@/lib/csat/authored/evidence'
import { recordAuthoredAttempt, requestAuthoredSupply } from '@/lib/csat/authored/server'
import { FakeClient } from '@/lib/csat/authored/__tests__/pglite-supabase'
import { R5_AUTHORED_SET, R5_CYCLE_SUPPLEMENT, authoredRef, findAuthored, isAssessmentRole } from '@/lib/knowledge/authored/authored-items'
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
const EV3 = path.join(ROOT, 'docs/implementation/learning-outcomes-20261021/evidence/2g-diagnostic')
const SUPP_BYTES = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/authored/r5-cycle-supplement.v2.json'))
const SUPP_RECEIPT = JSON.parse(fs.readFileSync(path.join(EV3, 'cycle-supplement-v2-ai-review.json'), 'utf8')) as AiReviewReceipt
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
const client = (uid: string | null, role = ''): ReflectionReader => ({
  async rpc<T>(fn: string, args: Record<string, unknown>) {
    await as(db, uid)
    // JWT role 클레임(PostgREST 가 넣는 값) — 학습자 세션 = '' · 서버 service 키 = 'service_role' · 익명 = 'anon'
    await db.query(`select set_config('request.jwt.claim.role', $1, false)`, [role])
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
/** auth.uid 없는 서버 호출(loadMapPage 의 service 클라이언트 자리) — 역할 클레임만 다르다 */
const roleClient = (role: 'service_role' | 'anon') => client(null, role)
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
async function world(uid: string): Promise<{ view: WorkspacePlanView; v4: V4View; status: string; data: MapPageData }> {
  const attempts = (await db.query<Row>(`select a.*, b.evidence, b.annotation_hash, d.role from learning_task_attempts a left join workspace_delivery_attempt b on b.attempt_id = a.id
    left join workspace_content_delivery d on d.id = b.delivery_id where a.user_id = $1 order by a.answered_at, a.id`, [uid])).rows
  const iso = (t: unknown) => (t ? new Date(t as string).toISOString() : null)
  const raw = attempts.map((a) => ({ userId: uid, attemptId: String(a.id), itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, isCorrect: a.is_correct, synthetic: false, helpLevel: a.help_level,
    afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: iso(a.answered_at), activity: a.activity, sessionId: a.session_id, contentHash: a.content_hash, expectedContentHash: null })) as unknown as FindAttemptRow[]
  const bound = applyAuthoredBindings(raw, attempts.filter((a) => a.annotation_hash).map((a) => ({ attemptId: String(a.id), evidence: a.evidence, annotationHash: a.annotation_hash, sessionId: a.session_id })))
  const deliveries = (await db.query<Row>(`select * from workspace_content_delivery where user_id = $1 and artifact_ref like 'authored:%' order by delivered_at`, [uid])).rows
  const check = deliveries.filter((d) => d.role === 'independent_check')
  // 2D — asOf 는 원장에서(벽시계 Date.now 없음): 마지막 시도 · 원문 교수 영수증 · 설명 수신 + 1초. 원장이 비면 고정 시각
  const ledger = (await db.query<{ t: string | null }>(`select max(t) t from (select max(received_at) t from factory_dcp_attempt where user_id = $1
    union all select max(received_at) from source_lesson_reflection where user_id = $1 union all select max(answered_at) from learning_task_attempts where user_id = $1) x`, [uid])).rows[0]?.t
  const asOf = new Date((ledger ? new Date(ledger).getTime() : Date.parse('2026-10-21T00:00:00Z')) + 1000).toISOString()
  const link = (d: Row) => ({ target: d.artifact_ref, href: '/csat/learn/' + d.artifact_ref.slice(9) + '?d=' + d.id, label: d.role, taskKey: KEY })
  const links = { [KEY]: check.map(link) }
  const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
  const receipts = await loadSourceRepairReceipts(roleClient('service_role') as never, uid, new Date(asOf))
  const repair = { [KEY]: [...deliveries.filter((d) => ['guided_practice', 'model_explanation'].includes(d.role)).map((d) => ({ ...link(d), role: d.role })), ...(receiptTargets(receipts, authoredKeysOf)[KEY] ?? [])] }
  const transfers = { [KEY]: deliveries.filter((d) => d.role === 'transfer').map(link) }
  const activity = attempts.map((a) => ({ itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, activity: a.activity, isCorrect: a.is_correct, answeredAt: iso(a.answered_at), receivedAt: iso(a.received_at),
    ...(a.role === 'guided_practice' ? { repairRole: 'guided_practice' as const } : {}) })).concat(receiptActivity(receipts, authoredKeysOf, new Date(asOf)) as never[]) as PlanActivity[]
  // Only unrelated diagnosis/reference observations are synthetic. Attempts, bindings,
  // deliveries, source receipts and saved plans come from this same SQL database.
  const data = {
    now: asOf,
    model: { goal: 80, goalSet: true, currentScore: 70,
      nodes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['A' + (i + 1), { achieved: [2, 5].includes(i) ? 0.2 : 0.9, points: 5, n: 10, den: 10 }])),
      lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) } },
    settings: { default_goal: 100, reference_exams: 6, status: { near: 0.9 }, min_coverage: 0.5, goal_presets: [100,90,80,70,60], core: { weak: 0.6, watch: 0.8 } },
    nodes: [], edges: [], tasks: [], sources: [], nodeSources: {}, edgeSources: {}, doneTaskIds: [], records: [],
    practiceLinks: { [KEY]: { taskKey: KEY, confirm: links[KEY] } }, findAttempts: bound, lifecycleActivity: activity,
    v4: { sessions: [{ id: 'synthetic-exam-record', examId: 'E', examLabel: 'Synthetic', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }],
      proxyCovers: ['synthetic-exam-record'], refItems: refs, transferItems: { [KEY]: transfers[KEY].length }, transferTargets: transfers, repairTargets: repair,
      saved: await loadSavedPlans(planDb(), uid), supplyLedger: {}, viewer: uid },
  } as unknown as MapPageData
  const v4 = composeV4(data, { score: data.model.goal, set: data.model.goalSet })!
  const view = v4.plans[TEMPLATE]!
  expect(view, 'actual composeV4 creates the canonical Workspace').toBeTruthy()
  const next = nextActionOf(v4, ranksOf(v4), data.v4!.saved)
  expect(next, 'actual nextActionOf returns an executable, supply, plan or waiting action').not.toBeNull()
  return { view, v4, status: String(v4.asIs.tasks[TASK as never]?.status), data }
}

/** Actual HTTP handler; only authentication and the SQL-backed page loader boundary are injected. */
async function postPlan(uid: string, body: unknown): Promise<{ status: number; body: Row }> {
  routeState.uid = uid
  routeState.db = planDb()
  routeState.load = async () => (await world(uid)).data
  const response = await planPOST(new Request('http://localhost/api/csat/diagnosis/map/plan', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))
  return { status: response.status, body: await response.json() }
}

const tpl = templateOf(TEMPLATE)!
const ORDER = [...tpl.core, ...tpl.support]
const request = (o: Partial<PlanCommitRequest>): PlanCommitRequest => ({ template: TEMPLATE, order: ORDER, planned: {}, reason: 'check_result', expectedVersion: 1, clientKey: key(), ...o }) as PlanCommitRequest

let goal1 = 0
let wsA = ''
let receipt1: RepairReceipt[] = []
let receipt2: RepairReceipt[] = []
let admitted: { qualification_id: string; dcp_item_id: string; approval_id: string }[] = []
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
  await db.exec(read('_pending_source_lesson_repair_receipt.sql'))
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  // 2E — 실제 buildDemand 의 taskKeys(checkKeysOfTask)로 실제 draft · packet 경로를 다시 돌린 합성 계보 패킷(입학 준비 아님).
  //   1B 역사 패킷(keys [])은 dcp-fixture 기본값으로 그대로 남는다. 문항 바이트 · 원문은 같다
  packet = await packetOf(false, snapshot(), checkKeysOfTask(TASK as never))
  output = outputOf(packet)
  const { content, ...rest } = row()
  await db.query(`insert into public.library_articles (id, content, row) values ($1, $2, $3::jsonb)`, [packet.body.source.id, content, JSON.stringify(rest)])
  const prep = await prepared(checkKeysOfTask(TASK as never))
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
    admitted = []
    for (const it of r.items) {
      // 2F — 실제 관리자 승인 경계(등록 후보 결속 확인 → 관리자 세션 content_release_approve)
      const ap0 = await approveFactoryDcp(planDb(), admin, it.qualification_id!, '2C 격리 — AI 검수 기반 후보')
      if (ap0.status !== 'ok' || ap0.replayed) throw new Error(JSON.stringify(ap0))
      const ap = { data: ap0.approval_id }
      admitted.push({ qualification_id: it.qualification_id!, dcp_item_id: it.dcp_item_id, approval_id: ap.data })
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

  it('2D 영수증: 세 단계 실제 채점 + 설명 = complete · current · 정오는 채점기 값 · asOf 앞 = 없음 · 타인 = 없음 · G2 0', async () => {
    const before = await Promise.all([count('public.learning_task_attempts'), count('public.workspace_delivery_attempt'), count('public.factory_dcp_attempt')])
    const rec = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: '2100-01-01T00:00:00Z' })).data)!
    expect(rec).toHaveLength(1)
    expect(rec[0]).toMatchObject({ workspaceId: wsA, current: true, complete: true })
    expect(rec[0].steps.map((s) => [s.step, s.deliveryId, s.isCorrect])).toEqual((['main_point', 'title', 'topic'] as const).map((k) => [k, lessonDel[k]!.delivery, true]))
    receipt1 = rec
    expect(parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: '2000-01-01T00:00:00Z' })).data)).toEqual([])
    const far = '2100-01-01T00:00:00Z'
    expect(parseRepairReceipts((await client(B).rpc('source_lesson_repair_receipts', { p_user: B, p_as_of: far })).data)).toEqual([])
    // 2E 권한: 타인 p_user(authenticated) · 로그아웃(역할 없음) · anon 역할 = 42501. 진짜 service_role + 서버 userId = 그 사용자의 것만
    expect((await client(B).rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: far })).error?.code).toBe('42501')
    expect((await client(null).rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: far })).error?.code).toBe('42501')
    expect((await roleClient('anon').rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: far })).error?.code).toBe('42501')
    expect(parseRepairReceipts((await roleClient('service_role').rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: far })).data)).toEqual(rec)
    expect(parseRepairReceipts((await roleClient('service_role').rpc('source_lesson_repair_receipts', { p_user: B, p_as_of: far })).data)).toEqual([])
    expect(await loadSourceRepairReceipts(roleClient('service_role') as never, A, new Date(far))).toEqual(rec)
    // 권한 거절 · 모양 불일치는 빈 성공이 아니다(던진다) · 미설치만 빈 목록
    await expect(loadSourceRepairReceipts(client(B) as never, A, new Date(far))).rejects.toThrow(/42501/)
    // 기본 권한: 내부 사실 함수는 아무 역할도 실행 못 한다 · 영수증은 authenticated · service_role 만
    const grants = await db.query<{ r: string; f: string; ok: boolean }>(`select r, f, has_function_privilege(r, f, 'execute') ok from unnest(array['anon','authenticated','service_role']) r,
      unnest(array['public.source_lesson_fact_state(uuid,uuid)','public.source_lesson_repair_receipts(uuid,timestamptz)']) f order by f, r`)
    expect(grants.rows.map((g) => `${g.f.slice(7, g.f.indexOf('('))}:${g.r}:${g.ok}`)).toEqual(['source_lesson_fact_state:anon:false', 'source_lesson_fact_state:authenticated:false', 'source_lesson_fact_state:service_role:false',
      'source_lesson_repair_receipts:anon:false', 'source_lesson_repair_receipts:authenticated:true', 'source_lesson_repair_receipts:service_role:true'])
    expect(await Promise.all([count('public.learning_task_attempts'), count('public.workspace_delivery_attempt'), count('public.factory_dcp_attempt')])).toEqual(before)
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
        clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date(Date.parse(receipt1[0]!.completedAt!) + 1).toISOString(), helpLevel: 'independent', sec: 30 }, Date.now(), writer)
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

  it('2D 같은 목표의 v2 뒤: 끝난 교수 사실은 보존(current=false · 링크 없음) · 이번 회차(확인 오답) 앞의 완료는 바로잡기 성공이 아니다', async () => {
    const rec = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: '2100-01-01T00:00:00Z' })).data)!
    expect(rec).toHaveLength(1)
    expect(rec[0]).toMatchObject({ current: false, complete: true, completedAt: receipt1[0]!.completedAt })
    expect((await world(A)).v4.asIs.tasks[TASK]!.check!.verifiedAt! > rec[0]!.completedAt!, '확인 오답(이번 회차 시작)은 교수 완료 뒤').toBe(true)
    expect(receiptTargets(rec, authoredKeysOf)).toEqual({})
    const w = await world(A)
    const gate = repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity(rec, authoredKeysOf, new Date('2100-01-01T00:00:00Z')))
    // 실제 buildDemand — 실제 단계(repair)에서만 바로잡기 역할이 나온다. 안내 연습 = 청사진 활동 수 3(한 지문 · demand.ts GUIDED_LESSON_ITEMS)
    const dem = buildDemand(w.v4, TASK as never, TEMPLATE, { workspaceId: wsA, planVersion: 2, goalVersion: goal1 })
    expect(dem.lines.map((l) => [l.role, l.reason])).toEqual([['source_analysis', 'stage_repair'], ['model_explanation', 'stage_repair'], ['guided_practice', 'stage_repair']])
    expect(dem.lines.find((l) => l.role === 'guided_practice')!.quantity).toEqual({ n: 3, unit: '문항' })
    // 2C 시험의 초기 계획(check)에서는 바로잡기 줄이 나오지 않는다 — 2C 가 수동으로 만든 guided 수요는 실제 순서가 아니었다
    expect(buildDemand({ ...w.v4, taskPlans: w.v4.taskPlans.map((p) => (p.task === TASK ? { ...p, stage: 'check' } : p)) } as V4View, TASK as never, TEMPLATE, { workspaceId: wsA, planVersion: 1, goalVersion: goal1 }).lines.map((l) => l.role)).toEqual(['independent_check'])
    // 설명 저장은 오답 확인(verifiedAt)보다 먼저다 — 이전 회차 수행은 이번 회차를 진전시키지 않는다
    expect(gate.succeeded, JSON.stringify({ check: w.v4.asIs.tasks[TASK]!.check, done: rec[0].completedAt })).toBe(false)
  })

  it('2F 실제 요청 API → 공급 서비스 → 정본 SQL: 링크 대기(주문 보존) → 기존 D3 관리자 링크 → 3활동 수령 · 재시도 멱등 · 반례', async () => {
    const post = async (uid: string, body: unknown, headers: Record<string, string> = {}) => {
      routeState.uid = uid
      routeState.db = planDb()
      routeState.learner = client(uid)
      routeState.load = async () => (await world(uid)).data
      const res = await factoryRequestPOST(new Request('http://localhost/api/csat/factory/request', {
        method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
      }))
      return { status: res.status, body: await res.json() as Row, cache: res.headers.get('cache-control') }
    }
    const orders = () => count('public.factory_order where user_id = $1', [A])
    const deliveries = () => count('public.workspace_content_delivery where user_id = $1', [A])
    // 반례 — 출처 · 닫힌 키 · 다른 학습 묶음 · 계획 없는 학습자(B)는 아무것도 쓰지 않는다
    const o0 = await orders()
    expect((await post(A, { template: TEMPLATE }, { origin: 'http://evil.test' })).status).toBe(403)
    expect((await post(A, { template: TEMPLATE, userId: B })).status).toBe(400)
    expect((await post(A, { template: TEMPLATE, quantity: 9 })).status).toBe(400)
    expect((await post(A, '{bad')).status).toBe(400)
    expect((await post(B, { template: TEMPLATE })).body).toMatchObject({ code: 'plan_required' })
    expect(await orders()).toBe(o0)
    // ① 실제 repair 단계(v2) 수요 → 주문만 남고 링크 대기. 같은 요청 반복 = 같은 주문(행 증가 없음)
    const w1 = await post(A, { template: TEMPLATE })
    expect(w1).toMatchObject({ status: 200, body: { status: 'waiting_link' }, cache: 'no-store' })
    expect(await orders()).toBe(o0 + 1)
    expect(await post(A, { template: TEMPLATE })).toMatchObject({ status: 200, body: { status: 'waiting_link' } })
    expect(await orders()).toBe(o0 + 1)
    // 정본 수요는 지원하지 않는 역할까지 기록하지만 주문은 안내 연습 줄에만
    const order = await q1<{ id: string; role: string; quantity: number; signature: string }>(`select o.id, o.role, o.quantity, d.signature from public.factory_order o
      join public.workspace_content_demand_line l on l.id = o.line_id join public.workspace_content_demand d on d.id = l.demand_id where o.user_id = $1 order by o.created_at desc limit 1`, [A])
    expect(order).toMatchObject({ role: 'guided_practice', quantity: 3 })
    const roles = (await db.query<{ role: string }>(`select role from public.workspace_content_demand_line where demand_id = (select l.demand_id from public.workspace_content_demand_line l join public.factory_order o on o.line_id = l.id where o.id = $1) order by role`, [order.id])).rows.map((r) => r.role)
    expect(roles).toEqual(['guided_practice', 'model_explanation', 'source_analysis'])
    // ② 실제 관리자가 기존 D3 링크 경로(executeProductOrderLineage)로 연결 — 학습자 요청이 관리자를 고르지 않는다
    const linked = await executeProductOrderLineage(client(null) as never, ADMIN, {
      action: 'link', order_id: order.id, product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision,
      order_hash: packet.body.order.order_hash, demand_signature: order.signature, quantity: 3, reason: '2F 격리 — 관리자 연결', request_key: key(),
    })
    expect(linked.error).toBeNull()
    // ③ 같은 요청 → 승인된 현재 후보 3활동 수령(같은 원문 · 같은 주문) · 첫 링크 = 요지
    const d0 = await deliveries()
    const got = await post(A, { template: TEMPLATE })
    expect(got).toMatchObject({ status: 200, body: { status: 'delivered', delivered: 3, replayed: false } })
    expect(await deliveries()).toBe(d0 + 3)
    const mine = (await db.query<{ id: string; type: string; ref_id: string; order_id: string }>(`select d.id, i.type, i.ref_id, d.order_id from public.workspace_content_delivery d
      join public.csat_dcp_items i on i.id::text = d.artifact_ref where d.order_id = $1`, [order.id])).rows
    expect(mine.map((m) => m.type).sort()).toEqual(['main_point', 'title', 'topic'])
    expect(new Set(mine.map((m) => m.ref_id)).size).toBe(1)
    expect(mine.find((m) => m.type === 'main_point')!.id).toBe(got.body.first)
    expect((await openFactoryDelivery(learnerA, got.body.first)).ok).toBe(true)
    // ④ 응답 유실 재시도 = 같은 납품(새 행 없음)
    expect(await post(A, { template: TEMPLATE })).toMatchObject({ status: 200, body: { status: 'delivered', first: got.body.first, replayed: true } })
    expect(await deliveries()).toBe(d0 + 3)
    // ⑤ 관리자 승인 경계 — 등록 후보가 아닌 자격(창작 자격)은 RPC 전에 거절 · 기존 승인은 재승인 없이 같은 id
    const savedContent = (await q1<{ content: string }>('select content from public.library_articles where id=$1', [packet.body.source.id])).content
    try {
      await db.query('update public.library_articles set content=$2 where id=$1', [packet.body.source.id, savedContent + ' changed'])
      expect.soft((await post(A, { template: TEMPLATE })).body.status, 'stale existing delivery cannot be acknowledged as received').not.toBe('delivered')
    } finally {
      await db.query('update public.library_articles set content=$2 where id=$1', [packet.body.source.id, savedContent])
    }
    try {
      await db.query('insert into public.ineligible_sources values ($1)', [packet.body.source.id])
      expect.soft(await approveFactoryDcp(planDb(), admin, admitted[0]!.qualification_id, 'x'), 'current source policy is rechecked even for approval replay').toEqual({ status: 'rejected', code: 'source_not_eligible' })
    } finally {
      await db.query('delete from public.ineligible_sources where article_id=$1', [packet.body.source.id])
    }
    const approvals = await count('public.content_release_approval')
    const authoredQ = (await q1<{ id: string }>(`select id from public.content_qualification where artifact_kind = 'authored_item' limit 1`)).id
    expect(await approveFactoryDcp(planDb(), admin, authoredQ, 'x')).toEqual({ status: 'rejected', code: 'not_factory_candidate' })
    expect(await approveFactoryDcp(planDb(), admin, key(), 'x')).toEqual({ status: 'rejected', code: 'not_factory_candidate' })
    expect(await approveFactoryDcp(planDb(), admin, admitted[0]!.qualification_id, 'x')).toEqual({ status: 'ok', approval_id: admitted[0]!.approval_id, replayed: true })
    expect(await count('public.content_release_approval')).toBe(approvals)
    // 학습자 세션은 승인 RPC 를 실행해도 DB 가 거절한다(권한 상승 없음)
    expect((await learnerA.rpc('content_release_approve', { p_qualification: authoredQ, p_scope: 'public', p_note: 'x' })).error?.code).toBe('42501')
  })

  it('2D 정본 순서: repair 단계(v2)의 실제 buildDemand 줄 → 원문 교수 3활동 완료(이번 회차) → 영수증 → repairGate 성공 · 다음 = transfer', async () => {
    const w = await world(A)
    const real = buildDemand(w.v4, TASK as never, TEMPLATE, { workspaceId: wsA, planVersion: 2, goalVersion: goal1 })
    const guided = real.lines.find((l) => l.role === 'guided_practice')!
    const spec = packet.body.spec as unknown as { keys: string[] }
    const signatureOf = async (order: string) => (await db.query<{ s: string }>(`select d.signature s from public.factory_order o join public.workspace_content_demand_line l on l.id = o.line_id
      join public.workspace_content_demand d on d.id = l.demand_id where o.id = $1`, [order])).rows[0]?.s ?? null
    const product = { product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision, order_hash: packet.body.order.order_hash }
    const lineOf = async (l: typeof guided) => {
      await as(db, A)
      const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(A, { ...real, lines: [l] })])).id
      return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
    }
    // 2E — 제품 spec 이 실제 수요 키로 만들어졌으므로 실제 buildDemand 줄을 **고치지 않고** 그대로 주문한다(2D 의 taskKeys 지우기 제거)
    expect(guided.taskKeys).toEqual(['claim-support'])
    expect(spec.keys).toEqual(guided.taskKeys)
    const line = await lineOf(guided)
    let orderId: string | null = null
    const del: Record<string, { delivery: string; answer: number }> = {}
    for (const it of admitted) {
      const ap = { data: it.approval_id } // 같은 후보의 기존 출시 승인(재승인 없음)
      // 한 원문 교수 = 나눌 수 없는 3활동 1단위 — 공장 주문은 청사진 활동 수(3)
      const got = await receiveForLearner(learnerA, orderId ? async () => ({ ok: true, link_id: 'existing' }) : d3Linker(client(null), ADMIN, product, signatureOf, { quantity: 3, reason: '2D', requestKey: () => key() }),
        { lineId: line, orderId, quantity: 3, qualificationId: it.qualification_id, approvalId: ap.data, orderKey: key(), deliveryKey: key() })
      if (!got.ok) throw new Error(`${got.code} ${got.detail}`)
      orderId = got.order_id
      const t = await q1<{ type: string; answer: number }>(`select type, (answer_key->>'answer')::int answer from public.csat_dcp_items where id = $1`, [it.dcp_item_id])
      del[t.type] = { delivery: got.delivery_id, answer: t.answer }
    }
    // 시범만 · 설명 누락 = 미완료(성공 아님)
    const a1 = await submitFactoryAttempt(learnerA, del.main_point!.delivery, { choice: del.main_point!.answer, mutationId: key() })
    if (!a1.ok) throw new Error(a1.code)
    const asOfAll = () => new Date('2100-01-01T00:00:00Z')
    const part = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: asOfAll().toISOString() })).data)!
    expect(part.find((r) => r.orderId === orderId)).toBeUndefined()
    expect(repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity(part, authoredKeysOf, asOfAll())).succeeded).toBe(false)
    for (const step of ['main_point', 'title', 'topic'] as const) {
      const a = step === 'main_point' ? a1 : await submitFactoryAttempt(learnerA, del[step]!.delivery, { choice: del[step]!.answer, mutationId: key() })
      if (!a.ok) throw new Error(a.code)
      const s = await submitReflection(learnerA, a.result.receiptId, { body: bodyOf(step), mutationId: key(), deliveryId: del[step]!.delivery })
      expect(s.ok, step).toBe(true)
      if (step === 'title') {
        const two = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: asOfAll().toISOString() })).data)!.find((r) => r.orderId === orderId)!
        expect(two).toMatchObject({ complete: false, current: true })
        expect(repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity([two], authoredKeysOf, asOfAll())).succeeded, '2/3 활동 = 미완료').toBe(false)
      }
    }
    const rec = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: asOfAll().toISOString() })).data)!
    const mine = rec.find((r) => r.orderId === orderId)!
    expect(mine).toMatchObject({ complete: true, current: true })
    const gate = repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity(rec, authoredKeysOf, asOfAll()))
    expect(gate.succeeded).toBe(true)
    // 과거 asOf(완료 직전) = 미래 완료가 유입되지 않는다
    const before = new Date(Date.parse(mine.completedAt!) - 1)
    expect(repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity(parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: before.toISOString() })).data)!, authoredKeysOf, before)).succeeded).toBe(false)
    // 실제 workspacePlan 단계 = transfer(world 가 실제 loader 함수로 영수증을 읽는다)
    expect((await world(A)).view.tasks.find((t) => t.task === TASK)!.stage).toBe('transfer')
    // 교수 수행은 G2 · 독립 확인 근거가 아니다
    expect((await db.query<{ item_ref: string }>(`select item_ref from public.learning_task_attempts where user_id = $1`, [A])).rows.map((x) => x.item_ref).sort())
      .toEqual([authoredRef('r5-cm-ind-2'), authoredRef('r5-cm-ind-3')])
    receipt2 = rec
  })

  it('2D 같은 목표 v3(repair→다음 계획) 뒤에도 끝난 바로잡기 사실은 보존 → repair 로 되돌아가지 않음 · 구계획 신규 열기는 막힘', async () => {
    const w = await world(A)
    const cur = (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [wsA])).v
    expect(await postPlan(A, request({ reason: 'check_result', expectedVersion: cur, expectedGoalVersion: goal1 }))).toMatchObject({ status: 200, body: { version: cur + 1 } })
    const saved = await q1<Row>(`select plan from public.learner_workspace_plan where workspace_id = $1 and plan_version = $2`, [wsA, cur + 1])
    expect(saved.plan.tasks.find((t: Row) => t.task === TASK).stage, '저장된 다음 계획 = transfer').toBe('transfer')
    expect((await world(A)).view.tasks.find((t) => t.task === TASK)!.stage, '새 계획 뒤에도 repair 로 되돌아가지 않음').toBe('transfer')
    const rec = parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: '2100-01-01T00:00:00Z' })).data)!
    expect(rec.map((r) => r.completedAt)).toEqual(receipt2.map((r) => r.completedAt))
    expect(rec.every((r) => r.current === false)).toBe(true)
    expect(receiptTargets(rec, authoredKeysOf)).toEqual({})
    expect(repairGate(w.v4.asIs.tasks[TASK]!, receiptActivity(rec, authoredKeysOf, new Date('2100-01-01T00:00:00Z'))).succeeded).toBe(true)
    expect(await openFactoryDelivery(learnerA, rec[rec.length - 1]!.steps[0]!.deliveryId)).toEqual({ ok: false, code: 'lineage_not_current' })
  })

  it('2E 보충 세트 실제 AI 검토 등록 → transfer 미노출 2지문(실제 buildDemand 공급) → recheck 새 독립 2 → 결과 → 다음 저장 계획', async () => {
    // 실제 두 AI 검토(Claude d44fe4b7 · Codex 01a15e16) 영수증 + 원본 응답 · 세션(evidence/2d-cycle) — 사람 결정 0 · 권리 부여 아님
    const ev = JSON.parse(fs.readFileSync(path.join(EV3, 'cycle-supplement-v2-ai-evidence.json'), 'utf8')) as { roles: { metadata: Row; response: string }[] }
    const raw = Object.fromEntries(ev.roles.map((r) => [r.metadata.agent, { result: r.response, session: r.metadata }])) as RawEvidence
    const human0 = await count('public.content_human_decision')
    const reg = await recordAiReviewedSupply(fcAdmin(), R5_CYCLE_SUPPLEMENT, SUPP_BYTES, SUPP_RECEIPT, raw)
    expect(reg, JSON.stringify(reg)).toMatchObject({ status: 'ok' })
    expect(await count('public.content_human_decision')).toBe(human0)
    const plan = async () => (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [wsA])).v
    const stage = async () => (await world(A)).view.tasks.find((t) => t.task === TASK)!.stage
    expect(await stage()).toBe('transfer')
    const seen0 = new Set((await db.query<{ r: string }>(`select artifact_ref r from public.workspace_content_delivery where user_id = $1`, [A])).rows.map((x) => x.r))
    // 고정 시각: 원장 마지막(2D 교수 완료) 뒤 분 단위
    const t0 = Date.parse(receipt2[receipt2.length - 1]!.completedAt!)
    let tick = 0
    const answer = async (ref: string, right: boolean) => {
      const item = findAuthored(ref)!.item
      const at = new Date(t0 + ++tick * 60_000).toISOString()
      const live = JSON.parse(fs.readFileSync(path.join(EV3, 'cycle-live-v3-ai-results.json'), 'utf8')) as { records: { agent: string; item_id: string; normalized_response: unknown; actual_product_grade: Record<string, unknown> }[] }
      const observed = live.records.find((r) => r.agent === 'codex' && authoredRef(r.item_id) === ref)
      expect(observed, 'fresh AI learner response exists, no Gold-generated success response').toBeTruthy()
      const res = await recordAuthoredAttempt(fcAdmin(), fcLearner(A), { id: A, email: null }, ref, {
        deliveryId: await dOf(A, ref), response: right ? observed!.normalized_response : wrongResponse('central_meaning', item.body as never, item.gold as never),
        clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: at, helpLevel: 'independent', sec: 30 }, Date.parse(at), writer)
      expect(res.grade.isCorrect, ref).toBe(right)
      if (right) expect(res.grade, 'real response component grades are preserved, including disagreements').toEqual(observed!.actual_product_grade)
      expect(res.binding, ref).toMatchObject({ status: 'bound', evidence: true })
    }
    const supply = async () => {
      const w = await world(A)
      const sup = await requestAuthoredSupply(fcAdmin(), fcLearner(A), A, { view: w.v4, task: TASK as never, template: TEMPLATE, workspaceId: wsA, planVersion: await plan(), goalVersion: goal1 })
      if (sup.status !== 'ok') throw new Error(sup.status)
      return sup.lines.flatMap((l) => l.delivered).sort()
    }
    // transfer — 실제 buildDemand(transfer 단계) 줄 → 서로 다른 지문 2(보충 세트 전이 포함) · 이전 노출 0
    const xfer = await supply()
    const groupOf = (ref: string) => findAuthored(ref)!.item.passageGroup
    expect(xfer.length, JSON.stringify(xfer)).toBe(2)
    expect(xfer.every((r) => findAuthored(r)!.item.role === 'transfer' && !seen0.has(r))).toBe(true)
    expect(new Set(xfer.map(groupOf)).size).toBe(2)
    expect(xfer).toContain(authoredRef('r5-cycle-transfer-2'))
    for (const r of xfer) await answer(r, true) // 신규 Codex 세션의 실제 응답 — 최초 오답 상태는 합성, 학습 향상/인과효과 주장이 아님
    expect(await stage()).toBe('recheck')
    // recheck — 새 독립 확인 2 · 이전 확인 · 교수 · 전이 노출과 겹치지 않음
    const seen1 = new Set((await db.query<{ r: string }>(`select artifact_ref r from public.workspace_content_delivery where user_id = $1`, [A])).rows.map((x) => x.r))
    const re = await supply()
    expect(re.length, JSON.stringify(re)).toBe(2)
    expect(re.every((r) => findAuthored(r)!.item.role === 'independent_check' && !seen1.has(r))).toBe(true)
    expect(new Set([...re.map(groupOf), ...xfer.map(groupOf)]).size).toBe(4)
    for (const r of re) await answer(r, true)
    const after = (await world(A))
    const row = after.view.tasks.find((t) => t.task === TASK)!
    // 결과: 실제 AI 응답의 새 독립 2 통과 → resolved · 전이 이력 반영 → MAINTAIN/recheck.
    // 최초 오답 상태는 합성 기능 회귀이며 이 연결을 인과 학습효과로 주장하지 않는다.
    expect({ stage: row.stage, status: after.status, need: after.v4.toBe?.needs.find((n) => n.task === TASK)?.type }).toEqual({ stage: 'recheck', status: 'resolved', need: 'MAINTAIN' })
    // 결과 → 다음 계획 저장(정본 계획 RPC) · 저장 단계 = 다시 계산한 단계
    const cur = await plan()
    expect(await postPlan(A, request({ reason: 'check_result', expectedVersion: cur, expectedGoalVersion: goal1 }))).toMatchObject({ status: 200, body: { version: cur + 1 } })
    const saved = await q1<Row>(`select plan from public.learner_workspace_plan where workspace_id = $1 and plan_version = $2`, [wsA, cur + 1])
    expect(saved.plan.tasks.find((t: Row) => t.task === TASK).stage).toBe(row.stage)
    // G2 = 창작 평가 응답만(교수 · 원문 안내 연습에서 G2 를 만들지 않음)
    const g2refs = (await db.query<{ r: string }>(`select item_ref r from public.learning_task_attempts where user_id = $1`, [A])).rows.map((x) => x.r)
    expect(g2refs.every((r) => r.startsWith('authored:') && isAssessmentRole(findAuthored(r)!.item.role))).toBe(true)
    expect(g2refs).toHaveLength(6)
  })

  it('낡은 목표 = goal_changed · 새 목표로 v3 · 다른 학습자는 A 의 계획을 못 건드린다', async () => {
    const g2 = (await setGoal(planDb(), A, 85, key())).goalVersionId!
    const cur = (await q1<{ v: number }>(`select max(plan_version)::int v from public.learner_workspace_plan where workspace_id = $1`, [wsA])).v
    expect(await postPlan(A, request({ expectedVersion: cur, expectedGoalVersion: goal1 }))).toMatchObject({ status: 409, body: { code: 'goal_changed' } })
    expect(await postPlan(A, request({ reason: 'goal_change', expectedVersion: cur, expectedGoalVersion: g2 }))).toMatchObject({ status: 200, body: { version: cur + 1 } })
    expect(Number((await q1<{ g: number }>(`select goal_version_id g from public.learner_workspace_plan where workspace_id = $1 and plan_version = $2`, [wsA, cur + 1])).g)).toBe(g2)
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
    expect(await count('public.source_lesson_reflection where user_id = $1', [A])).toBe(6) // 2C 회차 앞 3 + 2D 회차 안 3
    // 2D — 목표가 바뀌면(g2 · goal_change v3) 이전 목표 회차의 교수 사실은 새 회차로 넘어오지 않는다
    expect(parseRepairReceipts((await learnerA.rpc('source_lesson_repair_receipts', { p_user: A, p_as_of: '2100-01-01T00:00:00Z' })).data)).toEqual([])
  })
})
