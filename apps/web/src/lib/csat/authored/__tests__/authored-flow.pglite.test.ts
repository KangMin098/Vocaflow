// apps/web/src/lib/csat/authored/__tests__/authored-flow.pglite.test.ts
// FINAL LEVEL 1 — 격리 종단: 실제 보류 SQL(DB-1 → I2 → G2 → 창작 공급) + 실제 서버 코드(server.ts)를 PGlite 위에서 잇는다.
//   등록(R5 창작 9문항) → 자격 · 사람 결정 · 승인(승인 패키지 실행을 흉내) → 학습자 공급 요청(수요 · 공급 · 주문) → 자료 열기 →
//   풀이 기록 → G2 결속(근거 판정) → 재시도 멱등 → 다른 학습자 차단 → 권리 철회 → 지도 As-Is 가 창작 확인을 근거로 읽는다.
// 개발 DB 무관. ⚠️ PGlite 는 슈퍼유저 · 단일 연결 — RLS · 진짜 동시성은 다른 시험(authored-supply · G2 동시성 스크립트)의 몫이다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { AXES, B_SQL, C_SQL, STUB } from '../../map/v62/__tests__/supply-sql-harness'
import type { V4View } from '../../map/v4/compose'
import { asIsMap } from '../../map/v4/as-is'
import { DOMAINS } from '../../map/v4/definition'
import { repairGate, workspacePlan, type PlanActivity } from '../../map/v4/plan'
import { toBeMap } from '../../map/v4/to-be'
import { planWorkspaces } from '../../map/v4/workspace'
import type { AttemptWrite, AttemptWriter } from '@/lib/knowledge/practice-writer'
import { AUTHORED_SETS, R5_AUTHORED_SET, authoredRef, isAssessmentRole, registrationArgs, type AuthoredGold, type AuthoredSet } from '@/lib/knowledge/authored/authored-items'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { bindDeliveryAttempt, boundAttemptId } from '../../map/v62/delivery-binding'
import { applyAuthoredBindings } from '../evidence'
import { listDelivered, openDelivered, recordAuthoredAttempt, requestAuthoredSupply } from '../server'
import { FakeClient } from './pglite-supabase'
import { rightResponse, wrongResponse } from '@/lib/knowledge/__tests__/authored-responses'

const MIG = path.resolve(__dirname, '../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const V62 = path.resolve(__dirname, '../../map/v62/__tests__')
const G2_COLUMNS = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now(),
  add column if not exists client_mutation_id uuid;
  alter table public.learning_sessions add column if not exists stage text;`

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000c1'
const B = '00000000-0000-4000-8000-0000000000c2'
// T-0050 순환 — 다른 시험의 상태와 섞이지 않게 별도 학습자(pass · fail)
const C = '00000000-0000-4000-8000-0000000000c3'
const D = '00000000-0000-4000-8000-0000000000c4'
// T-0052 — 근거 찾기(e.evidence_location) 순환 학습자
const E = '00000000-0000-4000-8000-0000000000c5'
const F = '00000000-0000-4000-8000-0000000000c6'
const EVL = AUTHORED_SETS.find((x) => x.taskId === 'e.evidence_location')!
// T-0056 — 보조 TASK(e.task_demand · ws.evidence-locate 의 support) 학습자
const G = '00000000-0000-4000-8000-0000000000c7'
const TD = AUTHORED_SETS.find((x) => x.taskId === 'e.task_demand')!
// T-0066 — 보조 발문 요구(e.task_demand) 전체 순환 학습자(pass · fail)
const H = '00000000-0000-4000-8000-0000000000c8'
const I = '00000000-0000-4000-8000-0000000000c9'
// T-0068 — 비보류 13 TASK 순환(세트마다 pass · fail 학습자 한 쌍 · 다른 시험과 상태 분리)
const T68 = [
  ['e.option_correspondence', 'ws.option-match', 'opt'], ['r.discourse_function', 'ws.central-meaning', 'df'], ['r.discourse_structure', 'ws.central-meaning', 'ds'],
  ['r.inference', 'ws.inference', 'inf'], ['r.reference', 'ws.cohesion', 'ref'], ['r.relation', 'ws.cohesion', 'rel'], ['s.chunk_boundary', 'ws.sentence-core', 'cb'],
  ['s.form_scope', 'ws.grammar-scope', 'gs'], ['s.sentence_core', 'ws.sentence-core', 'sc'], ['s.structural_relation', 'ws.sentence-core', 'sr'],
  ['v.contextual_sense', 'ws.vocab-context', 'vcs'], ['v.multiword', 'ws.vocab-context', 'mw'], ['v.semantic_relation', 'ws.option-match', 'sem'],
].map(([task, template, p], k) => {
  const set = AUTHORED_SETS.find((x) => x.taskId === task)!
  const uid = (n: number) => `00000000-0000-4000-8000-000000000${(0xd00 + n).toString(16)}`
  return { set, task, template, p, pass: uid(2 * k), fail: uid(2 * k + 1) }
})
const TASK = 'r.central_meaning'
const TEMPLATE = 'ws.central-meaning'
const S = R5_AUTHORED_SET

let db: PGlite
let admin: SupabaseClient
const learner = (uid: string) => new FakeClient(db, uid) as unknown as SupabaseClient
const ws: Record<string, string> = {}
const q1 = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]!

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object), kb = Object.keys(b as object)
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** 서버 G2 쓰기 어댑터의 시험 사본 — 세션 공개 후 시도 한 행(같은 제출 id 재전송 = duplicate) */
const writer: AttemptWriter = {
  kind: 'g2',
  async reveal(w: AttemptWrite) {
    const r = await q1<{ id: string }>(`insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, help_level, revealed_at)
      values ($1,$2,$3,$4,$5,$6,$7, now()) on conflict do nothing returning id`, [w.userId, w.clientSessionId, w.activity, w.phase, w.itemRef, w.taskKey, w.helpLevel]).catch(() => null)
    if (r?.id) return r.id
    return (await q1<{ id: string }>(`select id from public.learning_sessions where user_id = $1 and client_session_id = $2`, [w.userId, w.clientSessionId])).id
  },
  async record(w: AttemptWrite, sessionId: string | null) {
    const prev = await db.query<{ response: unknown }>(`select response from public.learning_task_attempts where user_id = $1 and client_mutation_id = $2`, [w.userId, w.clientMutationId])
    const response = { ...w.answer, ...w.extra }
    // jsonb 는 키 순서를 바꾼다 — 문자열 비교 금지(AGENTS 「두 번 이상 고친 실수」). 키 순서 무관 비교
    if (prev.rows.length) return same(prev.rows[0].response, JSON.parse(JSON.stringify(response))) ? 'duplicate' : 'conflict'
    await db.query(`insert into public.learning_task_attempts (user_id, task_key, item_ref, session_id, phase, activity, help_level, content_hash, response, is_correct, client_mutation_id, answered_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [w.userId, w.taskKey, w.itemRef, sessionId, w.phase, w.activity, w.helpLevel, w.contentHash, JSON.stringify(response), w.isCorrect, w.clientMutationId, w.answeredAt])
    return 'inserted'
  },
  async noteExplanationView() { return false },
}

/** 계획 보기의 최소 모양 — buildDemand 가 읽는 칸만(단계 · 계획량 · 필요) */
const viewAt = (stage: string | null, planned: number | null, need: string | null = 'GAP') => ({
  taskPlans: [{ task: TASK, stage, need, quantity: { planned, done: 0 } }],
  asIs: { asOf: '2026-10-18T00:00:00.000Z', tasks: { [TASK]: { status: 'verified_need', check: { independentItems: 2 } } } }, toBe: null,
}) as unknown as V4View

const meta = (o: Record<string, unknown> = {}) => ({
  clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date(Date.now() - 1000).toISOString(), helpLevel: 'independent', sec: 30, ...o,
})
const goldOf = (id: string) => S.items.find((i) => i.id === id)!.gold as AuthoredGold
const rightAnswer = (id: string) => { const g = goldOf(id); return { claim: g.claim, support: g.support, relation: g.relationProbe.relation, choice: g.answer } }
const supply = (uid: string, stage: string | null, planned: number | null, need?: string | null, planVersion = 1) =>
  requestAuthoredSupply(admin, learner(uid), uid, { view: viewAt(stage, planned, need), task: TASK, template: TEMPLATE, workspaceId: ws[uid], planVersion, goalVersion: null })

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(fs.readFileSync(path.join(V62, 'supply-i1-stub.sql'), 'utf8'))
  await db.exec(G2_COLUMNS)
  await db.exec(`alter table public.learning_sessions add constraint ls_cs unique (user_id, client_session_id)`)
  await db.exec(C_SQL); await db.exec(B_SQL)
  await db.exec(read('_pending_workspace_supply_i1_safety.sql'))
  await db.exec(read('20261018120000_workspace_supply_c_annotation_binding.sql'))
  await db.exec(read('20261018120100_r5_delivery_g2_binding.sql'))
  await db.exec(read('_pending_authored_supply.sql'))
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${F}'), ('${G}'), ('${H}'), ('${I}'), ${T68.flatMap((x) => [x.pass, x.fail]).map((u) => `('${u}')`).join(', ')}; insert into public.admins values ('${ADMIN}', 'admin');`)
  for (const uid of [A, B, C, D, E, F, G, H, I, ...T68.flatMap((x) => [x.pass, x.fail])]) {
    ws[uid] = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [uid])).id
    await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [ws[uid], uid])
  }
  admin = new FakeClient(db, ADMIN) as unknown as SupabaseClient
  // ── 승인 패키지 실행 흉내: 등록 → 자격 → 사람 결정(권리 · 평가 역할 Gold) → 승인 ──
  for (const [set, item] of [S, EVL, TD, ...T68.map((x) => x.set)].flatMap((x) => x.items.map((i) => [x, i] as const))) {
    const r = await (admin as unknown as FakeClient).rpc('authored_item_register', registrationArgs(set, item))
    if (r.error) throw new Error(r.error.message)
    const ref = authoredRef(item.id)
    const { rev, gh } = await q1<{ rev: string; gh: string }>(`select public.supply_artifact_revision('authored_item',$1) rev, public.authored_item_gold_hash($1) gh`, [ref])
    await (admin as unknown as FakeClient).auth()
    const qid = (await q1<{ id: string }>(`select public.content_qualification_record('FQ1.1','authored_item',$1,$2,$3,$4,$5::jsonb,'self',$2,null,'gold',$6,$7,$6,'{}','{blind-A,blind-B}','맹검 2인 + 사람 Gold',null) id`,
      [ref, rev, set.taskId, item.role, JSON.stringify(AXES()), gh, registrationArgs(set, item).p_annotation_ref])).id
    await db.query(`select public.content_human_decision_record('rights','authored_item',$1,$2,$2,'self_authored_original','{store,display,transmit,assess}','docs/final/review#rights','human-reviewed')`, [ref, rev])
    if (isAssessmentRole(item.role)) await db.query(`select public.content_human_decision_record('gold','authored_item',$1,$2,$3,'human_gold_review','{assess}','docs/final/review#gold','human-reviewed')`, [ref, rev, gh])
    await db.query(`select public.content_release_approve($1,'public')`, [qid])
    if (isAssessmentRole(item.role)) await db.query(`select public.content_release_approve($1,'assessment')`, [qid])
  }
}, 120000)

const ref = (id: string) => authoredRef(id)
/** 화면이 연 납품 id — 지도 · Workspace 링크의 ?d= 와 같은 값 */
const dOf = async (uid: string, r: string) => (await q1<{ id: string }>(`select id from public.workspace_content_delivery where user_id = $1 and artifact_ref = $2 order by delivered_at limit 1`, [uid, r])).id
const evidenceOf = async (uid: string, r: string) => q1<{ evidence: boolean; non_evidence_reason: string | null; help_state: string }>(
  `select evidence, non_evidence_reason, help_state from public.workspace_delivery_attempt where user_id = $1 and artifact_ref = $2 order by recorded_at desc limit 1`, [uid, r])

describe('공급 요청 — 수요 · 공급 · 주문', () => {
  it('바로잡기 단계: 교수 · 안내 연습은 공급, 원문 분석(재고 0)은 생산 주문으로 남는다', async () => {
    const r = await supply(A, 'repair', null)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    const byRole = Object.fromEntries(r.lines.map((l) => [l.role, l]))
    expect(byRole.model_explanation.delivered).toEqual([ref('r5-cm-teach-1')])
    // 2D — 안내 연습 기본 수량 = 교수 청사진 활동 수 3(demand.ts GUIDED_LESSON_ITEMS) → 창작 재고 2 전부 + 부족 1 은 생산 주문(초과 납품 아님 · 요구량 안)
    expect(byRole.guided_practice.delivered).toHaveLength(2)
    expect(byRole.guided_practice.orderOpened).toBe(true)
    expect(byRole.source_analysis).toMatchObject({ delivered: [], orderOpened: true })
  })

  it('확인 단계(계획량 2): 서로 다른 지문의 혼자 확인 2개 · 같은 요청 재시도 = 같은 공급(중복 없음)', async () => {
    const r1 = await supply(A, 'check', 2)
    const r2 = await supply(A, 'check', 2)
    if (r1.status !== 'ok' || r2.status !== 'ok') throw new Error('supply')
    expect(r1.lines[0].delivered.sort()).toEqual([ref('r5-cm-ind-1'), ref('r5-cm-ind-2')])
    expect(r2.lines[0].delivered.sort()).toEqual(r1.lines[0].delivered.sort())
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_content_delivery where user_id = $1 and role = 'independent_check'`, [A])).n).toBe(2)
  })
})

describe('자료 열기 · 풀이 · G2 결속', () => {
  it('납품된 자료만 열린다 · 보기에 Gold 가 없다 · 다른 학습자는 못 연다', async () => {
    const o = await openDelivered(admin, learner(A), A, ref('r5-cm-ind-1'))
    expect(o.status).toBe('ok')
    if (o.status === 'ok') {
      expect(o.view.done).toBeNull()
      expect(JSON.stringify(o.view)).not.toContain(goldOf('r5-cm-ind-1').gist)
      expect(o.view.teach).toBeNull()
    }
    expect((await openDelivered(admin, learner(B), B, ref('r5-cm-ind-1'))).status).toBe('not_delivered')
    expect((await openDelivered(admin, learner(A), A, ref('r5-cm-transfer-1'))).status).toBe('not_delivered')
  })

  it('혼자 확인 정답(독립) → 근거 · 해설은 응답 뒤에만 · 같은 제출 재전송 = 같은 결속', async () => {
    const body = { deliveryId: await dOf(A, ref('r5-cm-ind-1')), response: rightAnswer('r5-cm-ind-1'), ...meta() }
    const r = await recordAuthoredAttempt(admin, learner(A), { id: A, email: 'a@test.local' }, ref('r5-cm-ind-1'), body, Date.now(), writer)
    expect(r.grade.isCorrect).toBe(true)
    expect(r.binding).toMatchObject({ status: 'bound', evidence: true })
    expect(r.reveal.gist).toBe(goldOf('r5-cm-ind-1').gist)
    expect(await evidenceOf(A, ref('r5-cm-ind-1'))).toMatchObject({ evidence: true, help_state: 'independent' })
    const again = await recordAuthoredAttempt(admin, learner(A), { id: A, email: 'a@test.local' }, ref('r5-cm-ind-1'), body, Date.now(), writer)
    expect(again.binding).toMatchObject({ status: 'bound', evidence: true })
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_delivery_attempt where user_id = $1 and artifact_ref = $2`, [A, ref('r5-cm-ind-1')])).n).toBe(1)
  })

  it('T-0075 복구 — 같은 제출 id 다시 연결 = 같은 결속 · 본인 결속 행의 같은 수행 id · 시도/결속 행 수 불변 · 다른 학습자는 특정 불가', async () => {
    // 앞 시험에서 이미 저장 · 결속된 제출(새 시도를 만들지 않는다 — 이 화면의 「다시 연결하기」와 같은 조건)
    const saved = await q1<{ id: string; cmid: string; bid: string; ev: boolean }>(`select a.id::text id, a.client_mutation_id::text cmid, w.id::text bid, w.evidence ev from public.learning_task_attempts a join public.workspace_delivery_attempt w on w.attempt_id = a.id where a.user_id = $1 and a.item_ref = $2 order by a.id limit 1`, [A, ref('r5-cm-ind-1')])
    const body = { deliveryId: await dOf(A, ref('r5-cm-ind-1')), clientMutationId: saved.cmid }
    const first = { attemptId: saved.id, binding: { id: saved.bid, evidence: saved.ev } }
    expect(first.attemptId).toMatch(/^[1-9][0-9]*$/)
    const count = async () => (await q1<{ a: number; b: number }>(`select (select count(*)::int from public.learning_task_attempts where user_id = $1) a, (select count(*)::int from public.workspace_delivery_attempt where user_id = $1) b`, [A]))
    const before = await count()
    const input = { userId: A, itemRef: ref('r5-cm-ind-1'), clientMutationId: body.clientMutationId as string, artifactKind: 'authored_item' as const, deliveryId: body.deliveryId }
    const rebound = await bindDeliveryAttempt(learner(A), input)
    expect(rebound).toMatchObject({ status: 'bound', id: first.binding.id, evidence: first.binding.evidence })
    expect(await boundAttemptId(learner(A), A, rebound)).toBe(first.attemptId)
    expect(await count()).toEqual(before)
    // 다른 학습자 · 결속 아님 · 모르는 id → 특정 불가(null) — 추정하지 않는다
    expect(await boundAttemptId(learner(B), B, rebound)).toBeNull()
    expect(await boundAttemptId(learner(A), A, { status: 'error' })).toBeNull()
    expect(await boundAttemptId(learner(A), A, { status: 'bound', id: '00000000-0000-4000-8000-00000000dead' })).toBeNull()
  })

  it('단서를 연 혼자 확인 = 비근거(도움) · 교수 자료 풀이 = 연습 기록', async () => {
    await recordAuthoredAttempt(admin, learner(A), { id: A, email: 'a@test.local' }, ref('r5-cm-ind-2'), { deliveryId: await dOf(A, ref('r5-cm-ind-2')), response: rightAnswer('r5-cm-ind-2'), ...meta({ helpLevel: 'viewed_first' }) }, Date.now(), writer)
    expect(await evidenceOf(A, ref('r5-cm-ind-2'))).toMatchObject({ evidence: false, non_evidence_reason: 'help_state_mismatch', help_state: 'helped' })
    await recordAuthoredAttempt(admin, learner(A), { id: A, email: 'a@test.local' }, ref('r5-cm-teach-1'), { deliveryId: await dOf(A, ref('r5-cm-teach-1')), response: rightAnswer('r5-cm-teach-1'), ...meta() }, Date.now(), writer)
    expect(await evidenceOf(A, ref('r5-cm-teach-1'))).toMatchObject({ evidence: false, help_state: 'practice' })
  })

  it('전이 단계 공급 → 전이 풀이 = 전이 근거', async () => {
    const r = await supply(A, 'transfer', 2)
    if (r.status !== 'ok') throw new Error('supply')
    expect(r.lines[0].delivered).toHaveLength(2)
    await recordAuthoredAttempt(admin, learner(A), { id: A, email: 'a@test.local' }, ref('r5-cm-transfer-1'), { deliveryId: await dOf(A, ref('r5-cm-transfer-1')), response: rightAnswer('r5-cm-transfer-1'), ...meta() }, Date.now(), writer)
    expect(await evidenceOf(A, ref('r5-cm-transfer-1'))).toMatchObject({ evidence: true, help_state: 'transfer' })
  })

  it('형식이 틀린 응답 · 받지 않은 자료는 기록하지 않는다', async () => {
    await expect(recordAuthoredAttempt(admin, learner(A), { id: A, email: null }, ref('r5-cm-ind-1'), { deliveryId: await dOf(A, ref('r5-cm-ind-1')), response: { claim: 99 }, ...meta() }, Date.now(), writer)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(recordAuthoredAttempt(admin, learner(B), { id: B, email: null }, ref('r5-cm-ind-1'), { deliveryId: await dOf(A, ref('r5-cm-ind-1')), response: rightAnswer('r5-cm-ind-1'), ...meta() }, Date.now(), writer)).rejects.toMatchObject({ code: 'not_delivered' })
  })

  it('받은 자료 목록: 역할 · 풀었나 · 근거로 셌나', async () => {
    const rows = await listDelivered(learner(A), A, TASK)
    if (rows === 'not_installed') throw new Error('installed')
    const by = Object.fromEntries(rows.map((r) => [r.ref, r]))
    expect(by[ref('r5-cm-ind-1')]).toMatchObject({ attempted: true, evidence: true })
    expect(by[ref('r5-cm-ind-2')]).toMatchObject({ attempted: true, evidence: false })
    expect(by[ref('r5-cm-transfer-2')]).toMatchObject({ attempted: false, evidence: null })
  })
})

/**
 * T-0050 rev5 — 실제 서버 기록(recordAuthoredAttempt) · 보류 SQL · G2 결속 → As-Is → To-Be → Workspace → PLAN 계산의 순환(Codex verify-repair-map-cycle 를 상시 회귀로).
 * 공급은 실제 requestAuthoredSupply. 한계: 목표 · 기준 시험 메타데이터는 합성, PLAN 저장 이력 · 브라우저 · 네이티브 RLS 는 이 시험 밖.
 */
interface CycleCfg { label: string; set: AuthoredSet; task: string; template: string; key: string; ind: [string, string]; fresh: [string, string]; guided: string; tr: [string, string]; pass: string; fail: string }
function cycle(cfg: CycleCfg) { describe(`${cfg.label} — 바로잡기 → 적용 → 새 독립 확인 → 해소 · 재실패는 새 회차`, () => {
  const { key: KEY, task: CT, template: CW } = cfg
  const goldOfC = (id: string) => cfg.set.items.find((i) => i.id === id)!.gold as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  // 형식별 유효 정답 · 유효 오답 응답 — 시험 어댑터(authored-responses · 제품 채점기로 자체 검증) · 오답은 틀린 판단 + 맞는 이유 쪽
  const fmtC = cfg.set.format ?? 'central_meaning'
  const bodyOfC = (id: string) => cfg.set.items.find((i) => i.id === id)!.body as Record<string, unknown>
  const supplyC = (uid: string, stage: string | null, planned: number | null) => requestAuthoredSupply(admin, learner(uid), uid, { view: ({ taskPlans: [{ task: CT, stage, need: 'GAP', quantity: { planned, done: 0 } }], asIs: { asOf: '2026-10-18T00:00:00.000Z', tasks: { [CT]: { status: 'verified_need', check: { independentItems: 2 } } } }, toBe: null }) as unknown as V4View, task: CT as never, template: CW, workspaceId: ws[uid], planVersion: 1, goalVersion: null })
  type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  async function world(uid: string) {
    const attempts = (await db.query<Row>(`select a.*, b.evidence, b.annotation_hash, d.role from learning_task_attempts a left join workspace_delivery_attempt b on b.attempt_id = a.id left join workspace_content_delivery d on d.id = b.delivery_id where a.user_id = $1 order by a.answered_at, a.id`, [uid])).rows
    const iso = (t: unknown) => (t ? new Date(t as string).toISOString() : null)
    const raw = attempts.map((a) => ({ userId: uid, attemptId: String(a.id), itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, isCorrect: a.is_correct, synthetic: false, helpLevel: a.help_level, afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: iso(a.answered_at), activity: a.activity, sessionId: a.session_id, contentHash: a.content_hash, expectedContentHash: null })) as unknown as FindAttemptRow[]
    const read = applyAuthoredBindings(raw, attempts.filter((a) => a.annotation_hash).map((a) => ({ attemptId: String(a.id), evidence: a.evidence, annotationHash: a.annotation_hash, sessionId: a.session_id })))
    const deliveries = (await db.query<Row>('select * from workspace_content_delivery where user_id = $1 order by delivered_at', [uid])).rows
    const check = deliveries.filter((d) => d.role === 'independent_check')
    const asOf = new Date(Math.max(Date.now(), ...attempts.map((a) => new Date(a.answered_at).getTime())) + 1000).toISOString()
    const map = asIsMap({ asOf, sessions: [{ id: 'synthetic-exam-record', examId: 'E', examLabel: 'Synthetic', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: { state: Object.fromEntries(DOMAINS.map((d) => [d, 'check_first'])), contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) } as never, checks: [{ taskKey: KEY, items: check.map((d) => d.artifact_ref) }], attempts: read })
    const link = (d: Row) => ({ target: d.artifact_ref, href: '/csat/learn/' + d.artifact_ref.slice(9) + '?d=' + d.id, label: d.role })
    const links = { [KEY]: check.map(link) }
    const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
    const goal = toBeMap({ asIs: map, goal: { score: 80, set: true }, refItems: refs as never, lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) } as never, confirmLinks: links as never })
    const repair = { [KEY]: deliveries.filter((d) => ['guided_practice', 'model_explanation'].includes(d.role)).map((d) => ({ ...link(d), role: d.role })) }
    const transfers = { [KEY]: deliveries.filter((d) => d.role === 'transfer').map(link) }
    const homes = planWorkspaces({ asIs: map, toBe: goal, confirmLinks: links as never, repairTargets: repair as never, transferTargets: transfers as never, transferItems: { [KEY]: transfers[KEY].length } })
    const home = [homes.primary, ...homes.others].find((x) => x?.id === CW)!
    const activity = attempts.map((a) => ({ itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, activity: a.activity, isCorrect: a.is_correct, answeredAt: iso(a.answered_at), receivedAt: iso(a.received_at), ...(a.role === 'guided_practice' ? { repairRole: 'guided_practice' as const } : {}) })) as PlanActivity[]
    const plan = workspacePlan(home, map, goal, homes, activity)
    return { map, goal, plan, activity, task: map.tasks[CT as never] as (typeof map.tasks)[keyof typeof map.tasks], row: plan.tasks.find((t) => t.task === CT)! }
  }
  const answer = async (uid: string, id: string, right = true) => {
    const response = right ? rightResponse(fmtC, goldOfC(id)) : wrongResponse(fmtC, bodyOfC(id), goldOfC(id))
    await recordAuthoredAttempt(admin, learner(uid), { id: uid, email: null }, ref(id), { ...meta({ helpLevel: id.includes('guided') ? 'viewed_first' : 'independent' }), deliveryId: await dOf(uid, ref(id)), response }, Date.now(), writer)
  }
  const bindings = async (uid: string) => (await db.query<Row>('select * from workspace_delivery_attempt where user_id = $1 order by attempt_id', [uid])).rows
  const toRecheck = async (uid: string) => {
    // 전이 자료는 미리 넣지 않는다 — 바로잡기 성공 뒤 그 단계 수요로 실제 공급받아야 한다(T-0052 Codex P1: 선납품 fixture 가 순환을 가렸다)
    await supplyC(uid, 'check', 2); await supplyC(uid, 'repair', null)
    await answer(uid, cfg.ind[0], false); await answer(uid, cfg.ind[1], false)
    let w = await world(uid)
    expect(w.task.status).toBe('verified_need'); expect(w.row.stage).toBe('repair')
    await answer(uid, cfg.guided, false); w = await world(uid); expect(w.row.stage, '안내 연습 오답은 바로잡기 성공이 아니다').toBe('repair')
    await answer(uid, cfg.guided, true); w = await world(uid)
    expect(w.row.stage, '전이 자료가 아직 없어도 적용 단계(건너뛰지 않음)').toBe('transfer'); expect(w.task.status, '안내 연습은 독립 근거가 아니다').toBe('verified_need')
    // T-0070 — 정본 readiness 가 live 가 아닌 Workspace 의 중심 TASK(창작 납품으로 열림)도 「콘텐츠 없음」이 아니라 이 단계 자료 부족이다
    expect(w.row.unresolved, '자료가 없으면 부족으로 보인다(가용량을 만들지 않음)').toContain('material_needed')
    expect(w.row.unresolved, '실제 납품이 있는 묶음을 콘텐츠 없음이라 하지 않는다').not.toContain('no_content')
    const tr = await requestAuthoredSupply(admin, learner(uid), uid, { view: { asIs: w.map, toBe: w.goal, taskPlans: w.plan.tasks } as V4View, task: CT as never, template: CW, workspaceId: ws[uid], planVersion: 1, goalVersion: null })
    expect(tr.status).toBe('ok'); if (tr.status !== 'ok') throw new Error('supply')
    expect(tr.lines.map((l) => l.role), '적용 단계 수요 = 전이').toEqual(['transfer'])
    expect(tr.lines[0].delivered.sort(), '서로 다른 전이 2지문 실제 공급').toEqual([ref(cfg.tr[0]), ref(cfg.tr[1])].sort())
    await answer(uid, cfg.tr[0], true); await answer(uid, cfg.tr[1], false)
    w = await world(uid); expect(w.row.stage).toBe('recheck'); expect(w.task.status, '전이는 독립 근거가 아니다').toBe('verified_need')
    const req = await requestAuthoredSupply(admin, learner(uid), uid, { view: { asIs: w.map, toBe: w.goal, taskPlans: w.plan.tasks } as V4View, task: CT as never, template: CW, workspaceId: ws[uid], planVersion: 1, goalVersion: null })
    expect(req.status).toBe('ok'); if (req.status !== 'ok') throw new Error('supply')
    expect(req.lines.flatMap((l) => l.delivered).sort(), '이미 본 평가 지문(ind-1 · 2)은 다시 납품하지 않는다').toEqual([ref(cfg.fresh[0]), ref(cfg.fresh[1])].sort())
    return bindings(uid)
  }
  it('pass — 새 지문 독립 확인 2 정답 → 해소 · 앞선 G2 결속 불변', async () => {
    const U = cfg.pass
    const before = await toRecheck(U)
    await answer(U, cfg.fresh[0], true); await answer(U, cfg.fresh[1], true)
    const w = await world(U)
    expect(w.task.status).toBe('resolved'); expect(w.row.achievement).toBe('resolved')
    const after = await bindings(U)
    expect(after.slice(0, before.length), '처음 독립 오답 · 안내 연습 · 전이 결속은 그대로').toEqual(before)
    expect(after.slice(before.length).map((r) => r.evidence), '새 독립 확인 2 = 근거').toEqual([true, true])
  }, 120000)
  it('fail — 다시 틀리면 새 바로잡기 회차 · 이전 안내 연습 성공 불승계 · 맞혔던 안내 연습을 다시 맞히면 회차 통과', async () => {
    const U = cfg.fail
    await toRecheck(U)
    await answer(U, cfg.fresh[0], false)
    let w = await world(U)
    expect(w.task.check?.status).toBe('still_needed'); expect(w.row.stage).toBe('repair')
    expect(repairGate(w.task, w.activity).succeeded, '회차 전 안내 연습 정답은 이번 회차 성공이 아니다').toBe(false)
    // 교수 자료는 정답 뒤에도 다시 풀 수 있다(서버 append-only 새 시도 · 근거 아님) → 이번 회차 성공
    await answer(U, cfg.guided, true)
    w = await world(U)
    expect(repairGate(w.task, w.activity).succeeded).toBe(true)
    expect(w.row.stage, '새 회차 안내 연습 정답 → 바로잡기 단계를 넘는다').not.toBe('repair')
    expect(w.task.status, '안내 연습은 해소 근거가 아니다').not.toBe('resolved')
    const guided = (await db.query<{ evidence: boolean }>('select evidence from workspace_delivery_attempt where user_id = $1 and artifact_ref = $2 order by attempt_id', [U, ref(cfg.guided)])).rows
    expect(guided.map((g) => g.evidence), '안내 연습 3회 모두 근거 아님').toEqual([false, false, false])
  }, 120000)
}) }
cycle({ label: 'T-0050 R5 중심 의미', set: S, task: 'r.central_meaning', template: 'ws.central-meaning', key: 'authored-central-meaning', ind: ['r5-cm-ind-1', 'r5-cm-ind-2'], fresh: ['r5-cm-ind-3', 'r5-cm-ind-4'], guided: 'r5-cm-guided-1', tr: ['r5-cm-transfer-1', 'r5-cm-transfer-2'], pass: C, fail: D })
// T-0052 rev1 — 근거 찾기: 같은 순환 · 같은 판정(새 독립 2 · 전이 1 은 이번에 보충한 ev-ind-3 · 4 · ev-transfer-2)
cycle({ label: 'T-0052 E 근거 위치', set: EVL, task: 'e.evidence_location', template: 'ws.evidence-locate', key: 'authored-evidence-locate', ind: ['ev-ind-1', 'ev-ind-2'], fresh: ['ev-ind-3', 'ev-ind-4'], guided: 'ev-guided-1', tr: ['ev-transfer-1', 'ev-transfer-2'], pass: E, fail: F })
// T-0066 — 보조 발문 요구(ws.evidence-locate 의 support): 같은 순환 · 같은 판정(새 독립 2 · 전이 1 은 이번에 보충한 td-ind-3 · 4 · td-transfer-2)
cycle({ label: 'T-0066 E1 발문 요구(보조)', set: TD, task: 'e.task_demand', template: 'ws.evidence-locate', key: 'authored-task-demand', ind: ['td-ind-1', 'td-ind-2'], fresh: ['td-ind-3', 'td-ind-4'], guided: 'td-guided-1', tr: ['td-transfer-1', 'td-transfer-2'], pass: H, fail: I })

// T-0068 — 비보류 13 TASK: 같은 순환(실제 공급 → 첫 독립 오답 → 안내 연습 → 실제 전이 2 → 미노출 새 독립 2 → G2 → As-Is/PLAN pass · fail)
for (const x of T68) cycle({ label: `T-0068 ${x.task}`, set: x.set, task: x.task, template: x.template, key: x.set.taskKey, ind: [`${x.p}-ind-1`, `${x.p}-ind-2`], fresh: [`${x.p}-ind-3`, `${x.p}-ind-4`], guided: `${x.p}-guided-1`, tr: [`${x.p}-transfer-1`, `${x.p}-transfer-2`], pass: x.pass, fail: x.fail })

describe('철회 · 다른 학습자', () => {
  it('지연 확인 권리 결정 철회 → 다른 학습자 공급 거절(사람 결정) · 앞선 기록은 그대로', async () => {
    const dec = (await q1<{ id: string }>(`select id from public.content_human_decision where artifact_ref = $1 and kind = 'rights'`, [ref('r5-cm-delayed-1')])).id
    await (admin as unknown as FakeClient).auth()
    await db.query(`select public.content_human_decision_revoke($1, '시험 철회')`, [dec])
    const r = await supply(B, null, null, 'MAINTAIN')
    if (r.status !== 'ok') throw new Error('supply')
    expect(r.lines[0].role).toBe('delayed_check')
    expect(r.lines[0].rejected).toContainEqual({ ref: ref('r5-cm-delayed-1'), reason: 'human_decision' })
    expect(r.lines[0].delivered).toEqual([ref('r5-cm-delayed-2')])
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_delivery_attempt where user_id = $1`, [A])).n).toBe(4)
  })
})

describe('지도 환류 — As-Is 가 창작 확인을 근거로 읽는다', () => {
  it('납품된 창작 확인 2문항의 독립 첫 시도 → r.central_meaning 근거가 직접 확인(direct_check)', async () => {
    const atts = (await db.query<{ id: number; item_ref: string; task_key: string; phase: string; is_correct: boolean; answered_at: string; activity: string; help_level: string; session_id: string; content_hash: string }>(
      `select id, item_ref, task_key, phase, is_correct, answered_at::text, activity, help_level, session_id::text, content_hash from public.learning_task_attempts where user_id = $1 and item_ref = any($2)`,
      [A, [ref('r5-cm-ind-1'), ref('r5-cm-ind-2')]])).rows
    const bindings = (await db.query<{ attempt_id: string; evidence: boolean; annotation_hash: string; session_id: string }>(
      `select attempt_id::text, evidence, annotation_hash, session_id::text from public.workspace_delivery_attempt where user_id = $1`, [A])).rows
    // loadFindAttempts 가 만드는 모양(코드 주석이 없어 기대 hash = null) → load.ts 와 같은 규칙(applyAuthoredBindings)
    const raw: FindAttemptRow[] = atts.map((a) => ({
      userId: A, attemptId: String(a.id), itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase as FindAttemptRow['phase'], isCorrect: a.is_correct,
      synthetic: false, helpLevel: a.help_level, afterViewedFirst: false, afterExplanation: false, timingUncertain: false,
      answeredAt: new Date(a.answered_at).toISOString(), activity: a.activity, sessionId: a.session_id, contentHash: a.content_hash, expectedContentHash: null,
    }))
    const rows = applyAuthoredBindings(raw, bindings.map((b) => ({ attemptId: b.attempt_id, evidence: b.evidence, annotationHash: b.annotation_hash, sessionId: b.session_id })))
    // 결속 규칙 없이 읽으면(기대 hash 없음) 창작 시도는 근거가 될 수 없다 — 규칙이 하는 일을 대조로 보인다
    const ungated = asIsMap({ asOf: new Date(Date.now() + 1000).toISOString(), sessions: [], axisProxy: null,
      checks: [{ taskKey: 'authored-central-meaning', items: [ref('r5-cm-ind-1'), ref('r5-cm-ind-2')] }], attempts: raw }).tasks[TASK]
    expect(ungated.check?.independentItems ?? 0).toBe(0)
    const before = asIsMap({ asOf: new Date().toISOString(), sessions: [], axisProxy: null, checks: [], attempts: [] }).tasks[TASK]
    const after = asIsMap({ asOf: new Date(Date.now() + 1000).toISOString(), sessions: [], axisProxy: null,
      checks: [{ taskKey: 'authored-central-meaning', items: [ref('r5-cm-ind-1'), ref('r5-cm-ind-2')] }], attempts: rows }).tasks[TASK]
    expect(before.basis).not.toBe('direct_check')
    expect(after.basis).toBe('direct_check')
    expect(after.check?.independentItems).toBe(1)   // 단서 연 문항은 독립에서 빠진다
    expect(after.check?.attemptedItems).toBe(2)
  })
})

describe('FI-007(#299) — 철회 뒤 현재성', () => {
  it('권리 철회된 납품은 열리지 않고(revoked) · 목록은 current=false · 재요청은 부족분을 다시 센다(과거 기록 보존)', async () => {
    const r = ref('r5-cm-ind-2')
    const d = await dOf(A, r)
    const dec = (await q1<{ id: string }>(`select id from public.content_human_decision where artifact_ref = $1 and kind = 'rights'`, [r])).id
    await (admin as unknown as FakeClient).auth()
    await db.query(`select public.content_human_decision_revoke($1, 'fi7 시험')`, [dec])
    expect(await openDelivered(admin, learner(A), A, r, d)).toEqual({ status: 'revoked', deliveryId: d })
    const rows = await listDelivered(learner(A), A, TASK)
    if (rows === 'not_installed') throw new Error('installed')
    expect(rows.find((x) => x.deliveryId === d)).toMatchObject({ current: false, attempted: true })
    const again = await supply(A, 'check', 2)
    if (again.status !== 'ok') throw new Error('supply')
    // ind-1 만 지금 유효 — 철회된 ind-2 는 충족으로 세지 않고 부족분을 다시 센다. 대체 재고(다시 확인용 ind-3 · 4)가 있으면 그것으로 채워 생산 주문을 열지 않는다
    expect(again.lines[0].delivered).toContain(ref('r5-cm-ind-1'))
    expect(again.lines[0].delivered).not.toContain(r)
    expect(again.lines[0].delivered.some((x) => x === ref('r5-cm-ind-3') || x === ref('r5-cm-ind-4'))).toBe(true)
    expect(again.lines[0].orderOpened).toBe(false)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.learning_task_attempts where user_id = $1 and item_ref = $2`, [A, r])).n).toBe(1)
  })
})


/**
 * T-0056 rev1 — 보조 TASK 대표 경로(e.task_demand · ws.evidence-locate support). 같은 실제 서버 기록 · 공급 · 결속 → As-Is → To-Be → Workspace(supportViews) → PLAN.
 * 중심 TASK(e.evidence_location) 자료 · 수행과 섞지 않는다. 세트 재고(독립 2 · 전이 1)가 부족한 단계는 부족으로 남는다(성공으로 바꾸지 않음).
 */
describe('T-0056 보조 TASK — 실제 공급 · 교수/연습 · 첫 독립 확인 · 같은 TASK 단계 · 재고 부족 보존', () => {
  const CT = 'e.task_demand', CW = 'ws.evidence-locate', KEY = 'authored-task-demand'
  type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const gold = (id: string) => TD.items.find((i) => i.id === id)!.gold as Row
  const answer = async (id: string, right: boolean) => {
    const g = gold(id)
    await recordAuthoredAttempt(admin, learner(G), { id: G, email: null }, ref(id), { ...meta({ helpLevel: id.includes('guided') ? 'viewed_first' : 'independent' }), deliveryId: await dOf(G, ref(id)), response: { choice: right ? g.answer : (g.answer + 1) % 5 } }, Date.now(), writer)
  }
  async function world() {
    const attempts = (await db.query<Row>(`select a.*, b.evidence, b.annotation_hash, d.role from learning_task_attempts a left join workspace_delivery_attempt b on b.attempt_id = a.id left join workspace_content_delivery d on d.id = b.delivery_id where a.user_id = $1 order by a.answered_at, a.id`, [G])).rows
    const iso = (t: unknown) => (t ? new Date(t as string).toISOString() : null)
    const raw = attempts.map((a) => ({ userId: G, attemptId: String(a.id), itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, isCorrect: a.is_correct, synthetic: false, helpLevel: a.help_level, afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: iso(a.answered_at), activity: a.activity, sessionId: a.session_id, contentHash: a.content_hash, expectedContentHash: null })) as unknown as FindAttemptRow[]
    const read = applyAuthoredBindings(raw, attempts.filter((a) => a.annotation_hash).map((a) => ({ attemptId: String(a.id), evidence: a.evidence, annotationHash: a.annotation_hash, sessionId: a.session_id })))
    const deliveries = (await db.query<Row>('select * from workspace_content_delivery where user_id = $1 order by delivered_at', [G])).rows
    const check = deliveries.filter((d) => d.role === 'independent_check')
    const asOf = new Date(Math.max(Date.now(), ...attempts.map((a) => new Date(a.answered_at).getTime())) + 1000).toISOString()
    const map = asIsMap({ asOf, sessions: [{ id: 'synthetic-exam-record', examId: 'E', examLabel: 'Synthetic', takenAt: '2026-09-01', enteredAt: '2026-09-02T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: { state: Object.fromEntries(DOMAINS.map((d) => [d, 'check_first'])), contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) } as never, checks: [{ taskKey: KEY, items: check.map((d) => d.artifact_ref) }], attempts: read })
    const link = (d: Row) => ({ target: d.artifact_ref, href: '/csat/learn/' + d.artifact_ref.slice(9) + '?d=' + d.id, label: d.role })
    const links = { [KEY]: check.map(link) }
    const refs = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
    const goal = toBeMap({ asIs: map, goal: { score: 80, set: true }, refItems: refs as never, lineRefItems: { B6: refs.slice(17, 24), A5: refs.slice(28, 34) } as never, confirmLinks: links as never })
    const repair = { [KEY]: deliveries.filter((d) => ['guided_practice', 'model_explanation'].includes(d.role)).map((d) => ({ ...link(d), role: d.role })) }
    const transfers = { [KEY]: deliveries.filter((d) => d.role === 'transfer').map(link) }
    const homes = planWorkspaces({ asIs: map, toBe: goal, confirmLinks: links as never, repairTargets: repair as never, transferTargets: transfers as never, transferItems: { [KEY]: transfers[KEY].length } })
    const home = [homes.primary, ...homes.others].find((x) => x?.id === CW)!
    const activity = attempts.map((a) => ({ itemRef: a.item_ref, taskKey: a.task_key, phase: a.phase, activity: a.activity, isCorrect: a.is_correct, answeredAt: iso(a.answered_at), receivedAt: iso(a.received_at), ...(a.role === 'guided_practice' ? { repairRole: 'guided_practice' as const } : {}) })) as PlanActivity[]
    const plan = workspacePlan(home, map, goal, homes, activity)
    return { map, goal, plan, home, row: plan.tasks.find((t) => t.task === CT)!, coreRow: plan.tasks.find((t) => t.task === 'e.evidence_location')! }
  }
  const supplyNow = async (w: Awaited<ReturnType<typeof world>>) => {
    const r = await requestAuthoredSupply(admin, learner(G), G, { view: { asIs: w.map, toBe: w.goal, taskPlans: w.plan.tasks } as V4View, task: CT as never, template: CW, workspaceId: ws[G], planVersion: 1, goalVersion: null })
    expect(r.status).toBe('ok'); if (r.status !== 'ok') throw new Error('supply')
    return r.lines
  }
  it('보조 TASK 의 실제 공급 → 첫 독립 오답 2 → 바로잡기 → 안내 연습 → 적용 단계(전이 재고 1/2 = 부족) · 중심 TASK 불변', async () => {
    let w = await world()
    expect(w.home.supportViews?.[CT as never], '납품 전에는 보조 TASK 창작 보기 없음').toBeUndefined()
    // 확인 자료 — 보조 TASK 의 수요로 실제 공급(정본 키 아님 · 그 TASK 의 창작 독립 확인만)
    const first = await requestAuthoredSupply(admin, learner(G), G, { view: ({ taskPlans: [{ task: CT, stage: 'check', need: 'GAP', quantity: { planned: 2, done: 0 } }], asIs: { asOf: '2026-10-18T00:00:00.000Z', tasks: { [CT]: { status: 'verified_need', check: { independentItems: 2 } } } }, toBe: null }) as unknown as V4View, task: CT as never, template: CW, workspaceId: ws[G], planVersion: 1, goalVersion: null })
    expect(first.status === 'ok' && first.lines.flatMap((l) => l.delivered).sort()).toEqual([ref('td-ind-1'), ref('td-ind-2')])
    w = await world()
    expect(w.row.unresolved, '보조 TASK 도 자기 자료로 계획된다').not.toContain('no_content')
    expect(w.row.next?.href ?? '', '다음 활동 = 보조 TASK 자료').toMatch(/td-ind-/)
    await answer('td-ind-1', false); await answer('td-ind-2', false)
    w = await world()
    expect(w.map.tasks[CT as never]?.status).toBe('verified_need')
    expect(w.row.stage).toBe('repair')
    expect(w.coreRow.quantity.available, '중심 TASK 자료 · 수행과 섞이지 않는다(중심 자료 0)').toBeNull()
    const rep = await supplyNow(w)
    expect(rep.some((l) => ['independent_check', 'transfer', 'delayed_check'].includes(l.role)), '바로잡기 수요에 평가 역할 없음').toBe(false)
    await answer('td-guided-1', false); w = await world(); expect(w.row.stage).toBe('repair')
    await answer('td-guided-1', true); w = await world()
    expect(w.row.stage, '안내 연습 정답 → 적용').toBe('transfer')
    expect(w.map.tasks[CT as never]?.status, '안내 연습은 독립 근거가 아니다').toBe('verified_need')
    // 재고 제한 fixture(명시) — T-0066 이 td-transfer-2 를 보충했으므로 이 반례는 그 한 편의 권리 결정을 철회해 「재고 1 / 계획 2」를 만든다.
    //   순환 시험(T-0066 H · I)은 이 describe 보다 먼저 정의 · 실행되어 철회의 영향을 받지 않는다
    const dec = (await q1<{ id: string }>(`select id from public.content_human_decision where artifact_ref = $1 and kind = 'rights'`, [ref('td-transfer-2')])).id
    await (admin as unknown as FakeClient).auth()
    await db.query(`select public.content_human_decision_revoke($1, '재고 제한 fixture — 부족 반례')`, [dec])
    const tr = await supplyNow(w)
    expect(tr.map((l) => l.role)).toEqual(['transfer'])
    expect(tr[0].delivered, '전이 재고 1(제한 fixture) — 2지문 계획에 모자람').toEqual([ref('td-transfer-1')])
    w = await world()
    expect(w.row.stage, '재고 부족은 적용 완료가 아니다').toBe('transfer')
    expect(w.row.unresolved).toContain('transfer_shortage')
    const binds = (await db.query<{ evidence: boolean; artifact_ref: string }>('select evidence, artifact_ref from workspace_delivery_attempt where user_id = $1 order by attempt_id', [G])).rows
    expect(binds.filter((b) => b.evidence).map((b) => b.artifact_ref).sort(), '독립 근거 = 처음 독립 확인 2 뿐').toEqual([ref('td-ind-1'), ref('td-ind-2')])
  }, 120000)
})
