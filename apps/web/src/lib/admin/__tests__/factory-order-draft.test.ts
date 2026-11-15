// apps/web/src/lib/admin/__tests__/factory-order-draft.test.ts
// 단계 1A — 저장 수요 → 실제 공장 설계기. 공장 함수(planner · sealer)는 mock 하지 않는다. 대역은 DB reader 뿐.
import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { buildStructuredProductOrderDraft } from '@vocaflow/library-pipeline/product-planning'

import {
  createFactoryOrderDraftPost,
  parseFactoryOrderDraftRequest,
  prepareFactoryOrderDraft,
  supabaseFactoryOrderDraftReader,
  type FactoryOrderDraftReader,
} from '@/lib/admin/factory-order-draft'
import type { AdminUser } from '@/lib/auth/require-admin-api'

import {
  canonicalBody,
  draftInput,
  fixtureState,
  LINE,
  NOW,
  OTHER,
  requestBody,
  sha,
  stubReader,
  USER,
  WORKSPACE,
  type FixtureState,
} from './factory-order-draft.fixture'

const parse = (body: unknown) => parseFactoryOrderDraftRequest(body)
const prepare = (state: FixtureState, body: unknown = requestBody(state), failOn?: keyof FactoryOrderDraftReader) =>
  prepareFactoryOrderDraft(stubReader(state, failOn).reader, parse(body), NOW)

/** 저장 본문을 바꾸고 서명도 맞춰 다시 계산 — 「서명은 맞지만 열과 다른」 변조 */
function withCanonical(state: FixtureState, overrides: Record<string, unknown>) {
  const canonical = canonicalBody(overrides)
  state.demand = { ...state.demand!, canonical, signature: sha(canonical) }
  return state
}

describe('A1 · A6 정상 수요 → 실제 공장 초안(비영속)', () => {
  it('실제 planner/sealer 결과와 같은 order·hash 를 돌려주고 생산·납품·검증 완료를 말하지 않는다', async () => {
    const state = fixtureState()
    const result = await prepare(state)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const direct = buildStructuredProductOrderDraft(draftInput(), NOW)
    expect(result.factory.order_hash).toBe(direct.order_hash)
    expect(result.factory.order).toEqual(direct.order)
    expect(result.factory.planning_hash).toBe(direct.planning_hash)
    expect(result.factory.product_family).toBe('P07')
    expect(result).toMatchObject({
      status: 'draft_prepared', persisted: false, lineage: 'not_registered', production: 'not_started',
      delivery: 'not_performed', mapping: 'candidate_unvalidated', registrable: false,
    })
    expect(result.demand).toEqual({
      demand_id: state.demand!.id, line_id: LINE, line_no: 2, signature: state.demand!.signature,
      definition_version: state.demand!.definition_version, goal_version_id: 7, plan_version: 3,
      role: 'guided_practice', task: 'r.central_meaning', quantity: 1,
    })
    expect(result.spec).toMatchObject({ schema: 'vf.factory-lineage-spec/1', task: 'r.central_meaning', role: 'guided_practice' })
    expect(result.blockers).toEqual(expect.arrayContaining(['crosswalk_not_validated', 'task_fit_review_missing', 'lineage_not_registered', 'production_not_run', 'delivery_not_performed']))
    expect(result.crosswalk.every((c) => c.status === 'candidate' && c.claim_scope === 'search_only' && !c.seal_order.ok)).toBe(true)
    // 개인 식별자가 공용 주문에 섞이지 않는다
    expect(JSON.stringify(result.factory.order)).not.toContain(USER)
    expect(JSON.stringify(result.factory.order)).not.toContain(WORKSPACE)
  })

  it('같은 입력 · 같은 주입 시각이면 같은 hash, 입력은 바뀌지 않고 reader 에는 조회만 있다', async () => {
    const state = fixtureState()
    const body = requestBody(state)
    const before = JSON.stringify(body)
    const stateBefore = JSON.stringify(state)
    const a = stubReader(state)
    const b = stubReader(state)
    const first = await prepareFactoryOrderDraft(a.reader, parse(body), NOW)
    const second = await prepareFactoryOrderDraft(b.reader, parse(body), NOW)
    expect(first.ok && second.ok && first.factory.order_hash === second.factory.order_hash).toBe(true)
    expect(JSON.stringify(body)).toBe(before)
    expect(JSON.stringify(state)).toBe(stateBefore)
    expect(a.calls.sort()).toEqual(['currentGoalVersionId', 'currentPlan', 'demand', 'demandLine', 'workspace'])
    const shifted = await prepareFactoryOrderDraft(stubReader(fixtureState()).reader, parse(requestBody()), '2026-10-22T00:00:00.000Z')
    expect(shifted.ok && first.ok && shifted.factory.order_hash !== first.factory.order_hash).toBe(true)
  })
})

describe('A4 서명 · 정본 · 줄 변조', () => {
  it('호출자 서명이 저장 서명과 다르면 거절', async () => {
    const state = fixtureState()
    expect(await prepare(state, { ...requestBody(state), expected_signature: 'f'.repeat(64) })).toMatchObject({ ok: false, status: 409, code: 'signature_mismatch' })
  })
  it('저장 본문이 서명과 다르면(행 변조) 거절', async () => {
    const state = fixtureState()
    state.demand = { ...state.demand!, canonical: canonicalBody({ planVersion: 4 }) }
    expect(await prepare(state)).toMatchObject({ ok: false, code: 'demand_integrity_mismatch', detail: 'signature_column' })
  })
  it('정규 직렬화가 아닌 본문(키 순서 변경)은 서명이 맞아도 정본이 아니다', async () => {
    const state = fixtureState()
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(state.demand!.canonical)).reverse()))
    state.demand = { ...state.demand!, canonical: reordered, signature: sha(reordered) }
    expect(await prepare(state)).toMatchObject({ ok: false, code: 'demand_integrity_mismatch', detail: 'canonical_form' })
  })
  it.each([
    ['user', { user: OTHER }],
    ['workspace', { workspaceId: OTHER }],
    ['goal', { goalVersion: 6 }],
    ['plan', { planVersion: 2 }],
    ['definition', { definitionVersion: 'v0' }],
    ['core', { core: 'v.contextual_sense' }],
  ])('정본 %s 이 DB 열과 다르면 거절', async (detail, overrides) => {
    const result = await prepare(withCanonical(fixtureState(), overrides))
    expect(result).toMatchObject({ ok: false, status: 409, code: 'demand_integrity_mismatch' })
    expect(!result.ok && result.detail).toContain(detail)
  })
  it.each([
    ['role', { role: 'model_explanation' }],
    ['task', { task_id: 'v.contextual_sense' }],
    ['quantity', { quantity: 5 }],
    ['line_no', { line_no: 9 }],
    ['line_owner', { user_id: OTHER }],
    ['line_owner', { workspace_id: OTHER }],
  ])('수요 줄 %s 변조는 거절', async (detail, change) => {
    const state = fixtureState()
    state.line = { ...state.line!, ...change }
    const result = await prepare(state)
    expect(result).toMatchObject({ ok: false, status: 409, code: 'demand_integrity_mismatch' })
    expect(!result.ok && result.detail).toContain(detail)
  })
})

describe('A5 현재성 · 소유 · 조회 실패는 fail closed', () => {
  it.each([
    ['paused Workspace', (s: FixtureState) => { s.workspace = { ...s.workspace!, status: 'paused' } }, 'workspace_inactive'],
    ['타인 Workspace', (s: FixtureState) => { s.workspace = { ...s.workspace!, user_id: OTHER } }, 'workspace_inactive'],
    ['Workspace 없음', (s: FixtureState) => { s.workspace = null }, 'workspace_inactive'],
    ['새 목표', (s: FixtureState) => { s.goal = 8 }, 'stale_demand'],
    ['목표 없음', (s: FixtureState) => { s.goal = null }, 'stale_demand'],
    ['새 계획', (s: FixtureState) => { s.plan = { plan_version: 4, goal_version_id: 7 } }, 'stale_demand'],
    ['계획 없음', (s: FixtureState) => { s.plan = null }, 'stale_demand'],
    ['계획의 목표 불일치', (s: FixtureState) => { s.plan = { plan_version: 3, goal_version_id: 6 } }, 'stale_demand'],
  ])('%s → 409, 초안 없음', async (_name, mutate, code) => {
    const state = fixtureState()
    mutate(state)
    expect(await prepare(state)).toMatchObject({ ok: false, status: 409, code })
  })
  it('구판 정의 버전(열 · 정본 일치) → stale', async () => {
    const state = withCanonical(fixtureState(), { definitionVersion: 'v-old' })
    state.demand = { ...state.demand!, definition_version: 'v-old' }
    expect(await prepare(state)).toMatchObject({ ok: false, code: 'stale_demand', detail: 'definition' })
  })
  it.each(['demandLine', 'demand', 'workspace', 'currentGoalVersionId', 'currentPlan'] as const)('%s 조회 오류 → 503 unavailable', async (name) => {
    expect(await prepare(fixtureState(), undefined, name)).toMatchObject({ ok: false, status: 503, code: 'demand_unavailable' })
  })
  it('줄 · 수요 누락은 빈 수요가 아니라 404', async () => {
    const body = requestBody()
    const a = fixtureState(); a.line = null
    expect(await prepare(a, body)).toMatchObject({ ok: false, status: 404, code: 'demand_line_not_found' })
    const b = fixtureState(); b.demand = null
    expect(await prepare(b, body)).toMatchObject({ ok: false, status: 404, code: 'demand_not_found' })
  })
})

describe('A7 공장 validator 오류를 숨기지 않는다', () => {
  it('plan_hash 구판 → PRODUCT_PLAN_STALE', async () => {
    expect(await prepare(fixtureState(), requestBody(undefined, { ...draftInput(), plan_hash: '0'.repeat(64) })))
      .toMatchObject({ ok: false, status: 422, code: 'factory_validation_failed', detail: 'PRODUCT_PLAN_STALE' })
  })
  it('계획 밖 학년 → GRADE_OUTSIDE_PLAN', async () => {
    expect(await prepare(fixtureState(), requestBody(undefined, { ...draftInput(), grade: 'middle_2' })))
      .toMatchObject({ ok: false, code: 'factory_validation_failed', detail: 'GRADE_OUTSIDE_PLAN' })
  })
  it('제품 capability 없음(PLANNED/UNSUPPORTED 제품군) → 공장 오류 코드', async () => {
    const result = await prepare(fixtureState(), requestBody(undefined, draftInput({ product_family: 'P20' })))
    expect(result).toMatchObject({ ok: false, code: 'factory_validation_failed' })
    expect(!result.ok && result.detail).not.toBe('UNKNOWN_FACTORY_ERROR')
  })
  it('요청 형식 단계에서 정책 hash 형식 오류는 400(서비스까지 오지 않는다)', () => {
    const bad = draftInput()
    bad.policies.rights = { version: 'rights-v1', hash: '' }
    expect(() => parseFactoryOrderDraftRequest(requestBody(undefined, bad))).toThrow()
  })
  it('수요 TASK 의 대응 후보와 다른 제품군은 조용히 맞다고 하지 않는다', async () => {
    const result = await prepare(fixtureState(), requestBody(undefined, draftInput({ product_family: 'P05', purpose: 'vocabulary_in_context' })))
    expect(result).toMatchObject({ ok: false, status: 422, code: 'product_family_mismatch' })
  })
  it('주문 초안에 학습자 · Workspace 식별자를 섞으면 거절', async () => {
    expect(await prepare(fixtureState(), requestBody(undefined, { ...draftInput(), product_order_id: `TPO-${USER}` })))
      .toMatchObject({ ok: false, code: 'personal_identifier_in_order' })
  })
})

describe('A8 평가 역할 · 대응 후보 승격 금지', () => {
  it('independent_check 줄은 guided practice 로 낮추지 않고 거절', async () => {
    const state = fixtureState()
    state.line = { ...state.line!, line_no: 3, role: 'independent_check', quantity: 2 }
    expect(await prepare(state)).toMatchObject({ ok: false, status: 422, code: 'role_not_supported', detail: 'independent_check' })
  })
  it.each(['transfer', 'delayed_check'])('%s 역할도 거절', async (role) => {
    const state = withCanonical(fixtureState(), {
      lines: [{ role, task: 'r.central_meaning', n: 2, types: [], keys: [], requires: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true }, reason: 'stage_transfer' }],
    })
    state.line = { ...state.line!, line_no: 0, role, quantity: 2 }
    expect(await prepare(state)).toMatchObject({ ok: false, code: 'role_not_supported' })
  })
  it('source_analysis 같은 비연습 역할도 1A 범위 밖으로 거절', async () => {
    const state = fixtureState()
    state.line = { ...state.line!, line_no: 0, role: 'source_analysis' }
    expect(await prepare(state)).toMatchObject({ ok: false, code: 'role_not_supported', detail: 'source_analysis' })
  })
  it('대응 후보가 없는 TASK 는 task_not_mapped 로 거절(초안 없음)', async () => {
    const state = withCanonical(fixtureState(), {
      core: 'r.unmapped_task',
      lines: [{ role: 'guided_practice', task: 'r.unmapped_task', n: 1, types: [], keys: [], requires: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false }, reason: 'stage_repair' }],
    })
    state.demand = { ...state.demand!, core_task: 'r.unmapped_task' }
    state.line = { ...state.line!, line_no: 0, task_id: 'r.unmapped_task' }
    expect(await prepare(state)).toMatchObject({ ok: false, status: 422, code: 'task_not_mapped' })
  })
})

// ── A2 · A3 · A9: 실제 handler → 서비스 → 실제 package validator ─────────────────
const admin: AdminUser = { id: OTHER, email: null, role: 'admin' }
function handler(opts: { guard?: AdminUser | NextResponse; state?: FixtureState; failOn?: keyof FactoryOrderDraftReader } = {}) {
  const stub = stubReader(opts.state ?? fixtureState(), opts.failOn)
  const reader = vi.fn(() => stub.reader)
  const now = vi.fn(() => NOW)
  const post = createFactoryOrderDraftPost({ guard: async () => opts.guard ?? admin, reader, now })
  return { post, reader, calls: stub.calls, now }
}
const req = (value: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new NextRequest('http://localhost/api/admin/csat/factory-order-draft', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
    body: raw ?? JSON.stringify(value),
  })

describe('A2 권한 가드가 DB · 파싱 · 설계보다 먼저다', () => {
  it.each([
    ['비로그인', NextResponse.json({}, { status: 401 }), 401],
    ['비관리자', NextResponse.json({}, { status: 403 }), 403],
    ['curator', { id: OTHER, email: null, role: 'curator' } as AdminUser, 403],
  ])('%s → %s, reader 생성 · 조회 0', async (_name, guard, status) => {
    const h = handler({ guard })
    expect((await h.post(req(requestBody()))).status).toBe(status)
    expect(h.reader).not.toHaveBeenCalled()
    expect(h.calls).toEqual([])
    expect(h.now).not.toHaveBeenCalled()
  })
})

describe('A3 출처 · 형식 · 크기 · 추가 신뢰 필드', () => {
  it.each([
    ['다른 Origin', req(requestBody(), { origin: 'http://evil.example' }), 403],
    ['Origin 없음', req(requestBody(), { origin: '' }), 403],
    ['JSON 아님', req(requestBody(), { 'content-type': 'text/plain' }), 415],
    ['깨진 JSON', req(null, {}, '{"demand_line_id":'), 400],
    ['초과 본문', req({ ...requestBody(), pad: 'x'.repeat(120001) }), 413],
    ['UUID 형식', req({ ...requestBody(), demand_line_id: 'line-1' }), 400],
    ['서명 형식', req({ ...requestBody(), expected_signature: 'abc' }), 400],
    ['user_id 주입', req({ ...requestBody(), user_id: USER }), 400],
    ['workspace 주입', req({ ...requestBody(), workspace_id: WORKSPACE }), 400],
    ['role 주입', req({ ...requestBody(), role: 'guided_practice' }), 400],
    ['수량 주입', req({ ...requestBody(), quantity: 50 }), 400],
    ['승인 주입', req({ ...requestBody(), approved: true }), 400],
    ['review id 주입', req({ ...requestBody(), draft: { ...draftInput(), review_id: 'r1' } }), 400],
    ['timestamp 주입', req({ ...requestBody(), draft: { ...draftInput(), created_at: NOW } }), 400],
  ])('%s → %s, 조회 0', async (_name, request, status) => {
    const h = handler()
    expect((await h.post(request)).status).toBe(status)
    expect(h.calls).toEqual([])
  })
})

describe('A9 실제 API handler 통합', () => {
  it('정상 요청 → 200, 실제 공장 hash · 비영속 상태 · 서버 주입 시각', async () => {
    const h = handler()
    const response = await h.post(req(requestBody()))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.factory.order_hash).toBe(buildStructuredProductOrderDraft(draftInput(), NOW).order_hash)
    expect(body.factory.order.created_at).toBe(NOW)
    expect(body).toMatchObject({ status: 'draft_prepared', persisted: false, production: 'not_started', delivery: 'not_performed', mapping: 'candidate_unvalidated', registrable: false })
    expect(body.ok).toBeUndefined()
    expect(h.now).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['stale', (s: FixtureState) => { s.goal = 8 }, undefined, 409, 'stale_demand'],
    ['조회 실패', () => {}, 'demandLine' as const, 503, 'demand_unavailable'],
    ['평가 역할', (s: FixtureState) => { s.line = { ...s.line!, line_no: 3, role: 'independent_check', quantity: 2 } }, undefined, 422, 'role_not_supported'],
  ])('%s → HTTP %s · 초안 없음', async (_name, mutate, failOn, status, code) => {
    const state = fixtureState()
    mutate(state)
    const response = await handler({ state, failOn }).post(req(requestBody(fixtureState())))
    expect(response.status).toBe(status)
    const body = await response.json()
    expect(body.code).toBe(code)
    expect(body.factory).toBeUndefined()
  })
  it('공장 validator 오류 코드가 응답에 그대로 보인다', async () => {
    const response = await handler().post(req(requestBody(undefined, { ...draftInput(), plan_hash: '0'.repeat(64) })))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'factory_validation_failed', detail: 'PRODUCT_PLAN_STALE' })
  })
  it('reader 생성 실패(환경 누락)는 503', async () => {
    const post = createFactoryOrderDraftPost({ guard: async () => admin, reader: () => { throw new Error('env') }, now: () => NOW })
    expect((await post(req(requestBody()))).status).toBe(503)
  })
})

describe('Supabase reader — 조회 전용 · 오류는 던진다', () => {
  function fakeDb(result: { data: unknown; error: unknown }) {
    const ops: string[] = []
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'order', 'limit']) chain[op] = (...args: unknown[]) => { ops.push(`${op}:${JSON.stringify(args)}`); return chain }
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result)
    const db = { from: (table: string) => { ops.push(`from:${table}`); return chain } }
    return { db: db as never, ops }
  }
  it('행 없음은 null, 오류는 예외, 두 행은 예외', async () => {
    expect(await supabaseFactoryOrderDraftReader(fakeDb({ data: [], error: null }).db).demandLine(LINE)).toBeNull()
    await expect(supabaseFactoryOrderDraftReader(fakeDb({ data: null, error: { code: '08006' } }).db).demandLine(LINE)).rejects.toThrow()
    await expect(supabaseFactoryOrderDraftReader(fakeDb({ data: [{}, {}], error: null }).db).demand('d', USER, WORKSPACE)).rejects.toThrow()
  })
  it('목표 · 계획은 최신 1행을 소유자 조건으로 읽고 insert/update/rpc 를 부르지 않는다', async () => {
    const f = fakeDb({ data: [{ id: 9 }], error: null })
    expect(await supabaseFactoryOrderDraftReader(f.db).currentGoalVersionId(USER)).toBe(9)
    expect(f.ops).toEqual(['from:csat_map_goal_version', 'select:["id"]', `eq:["user_id","${USER}"]`, 'order:["id",{"ascending":false}]', 'limit:[1]'])
    const p = fakeDb({ data: [{ plan_version: 3, goal_version_id: 7 }], error: null })
    expect(await supabaseFactoryOrderDraftReader(p.db).currentPlan(WORKSPACE, USER)).toEqual({ plan_version: 3, goal_version_id: 7 })
    expect(p.ops.join(' ')).toContain(`eq:["user_id","${USER}"]`)
    expect([...f.ops, ...p.ops].some((op) => /insert|update|upsert|delete|rpc/.test(op))).toBe(false)
  })
})
