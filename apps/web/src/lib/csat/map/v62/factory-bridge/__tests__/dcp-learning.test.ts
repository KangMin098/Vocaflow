// apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/dcp-learning.test.ts
// 1D DTO 경계 — DB 없이 RPC 응답 모양만 대역으로 준다(판정 자체는 dcp-learning.pglite.test.ts 가 실제 SQL 로 본다).
import { describe, expect, it } from 'vitest'

import { listFactoryDeliveries, openFactoryDelivery, parseAttemptBody, submitFactoryAttempt } from '../dcp-learning'
import type { SupplyClient } from '../dcp-supply'

const D = '11111111-1111-4111-8111-111111111111'
const I = '22222222-2222-4222-8222-222222222222'
const S = '33333333-3333-4333-8333-333333333333'
const W = '44444444-4444-4444-8444-444444444444'
const M = '55555555-5555-4555-8555-555555555555'
const fake = (data: unknown, error: { message: string; code?: string } | null = null): SupplyClient & { calls: unknown[] } => {
  const calls: unknown[] = []
  return { calls, rpc: async (fn, args) => { calls.push([fn, args]); return { data: data as never, error } } }
}

describe('parseAttemptBody — 닫힌 두 필드만', () => {
  it('정상', () => expect(parseAttemptBody({ choice: 3, mutationId: M })).toEqual({ choice: 3, mutationId: M }))
  it.each([
    [{ choice: 3 }], [{ choice: 0, mutationId: M }], [{ choice: 6, mutationId: M }], [{ choice: '3', mutationId: M }],
    [{ choice: 3, mutationId: 'x' }], [{ choice: 3, mutationId: M, userId: M }], [{ choice: 3, mutationId: M, correct: true }], [null], [[1]],
  ])('거절 %j', (b) => expect(parseAttemptBody(b)).toBeNull())
})

describe('openFactoryDelivery — 답변 전 화이트리스트', () => {
  const opened = { state: 'ok', delivery_id: D, workspace_id: W, source_id: S, attempts: 0,
    item: { id: I, type: 'topic', paragraph_idx: 0, payload: { passage: 'P', stem_ko: 'Q', choices: ['a', 'b', 'c', 'd', 'e'] } } }
  it('does not open a different delivery returned under the requested id', async () => {
    expect(await openFactoryDelivery(fake({ ...opened, delivery_id: M }), D)).toEqual({ ok: false, code: 'bad_shape' })
  })
  it.each([null, -1, 'not-a-count'])('does not turn unknown attempt counts into zero: %j', async (attempts) => {
    expect(await openFactoryDelivery(fake({ ...opened, attempts }), D)).toEqual({ ok: false, code: 'bad_shape' })
  })
  it('DB 가 정답 · 해설을 실어도 passage · stem_ko · choices 만 남긴다', async () => {
    const c = fake({ state: 'ok', delivery_id: D, workspace_id: W, source_id: S, attempts: 0,
      item: { id: I, type: 'topic', paragraph_idx: 0, payload: { passage: 'P', stem_ko: 'Q', choices: ['a', 'b', 'c', 'd', 'e'], answer: 1, rationale_ko: 'x' }, answer_key: { answer: 1 } } })
    const r = await openFactoryDelivery(c, D)
    if (!r.ok) throw new Error(r.code)
    expect(JSON.stringify(r.opened)).not.toMatch(/answer|rationale/)
    expect(r.opened.item.payload).toEqual({ passage: 'P', stem_ko: 'Q', choices: ['a', 'b', 'c', 'd', 'e'] })
  })
  it('비유효 상태는 그 코드 · 미설치 · 조회 실패를 구분', async () => {
    expect(await openFactoryDelivery(fake({ state: 'not_current' }), D)).toEqual({ ok: false, code: 'not_current' })
    expect(await openFactoryDelivery(fake(null, { message: 'x', code: 'PGRST202' }), D)).toEqual({ ok: false, code: 'not_installed' })
    expect(await openFactoryDelivery(fake(null, { message: 'timeout' }), D)).toEqual({ ok: false, code: 'query_failed' })
    expect(await openFactoryDelivery(fake({ state: 'weird' }), D)).toEqual({ ok: false, code: 'bad_shape' })
  })
})

describe('submitFactoryAttempt — 미상 정오를 오답으로 만들지 않는다', () => {
  const ok = { receipt_id: M, delivery_id: D, correct: false, csat_attempt_id: I, answer_key: { answer: 2 }, evidence: false, non_evidence_reason: 'role_not_evidence', replayed: false }
  it('정상 · 인자는 choice 만 담는다', async () => {
    const c = fake(ok)
    const r = await submitFactoryAttempt(c, D, { choice: 1, mutationId: M })
    expect(r.ok && r.result.correct).toBe(false)
    expect(c.calls[0]).toEqual(['factory_dcp_attempt', { p_delivery: D, p_answer: { choice: 1 }, p_mutation: M }])
  })
  it.each([{ ...ok, correct: null }, { ...ok, evidence: true }, { ...ok, delivery_id: S }, { ...ok, csat_attempt_id: '' },
    { ...ok, csat_attempt_id: 'not-a-uuid' }, { ...ok, csat_attempt_id: 42 }, { ...ok, replayed: undefined }, null])('모양 불일치 → bad_shape', async (d) => {
    expect(await submitFactoryAttempt(fake(d), D, { choice: 1, mutationId: M })).toEqual({ ok: false, code: 'bad_shape' })
  })
  it('DB 거절 코드 매핑', async () => {
    expect(await submitFactoryAttempt(fake(null, { message: 'attempt: delivery workspace_closed', code: 'P0001' }), D, { choice: 1, mutationId: M })).toEqual({ ok: false, code: 'workspace_closed' })
    expect(await submitFactoryAttempt(fake(null, { message: 'attempt: mutation key reused with a different body', code: '23505' }), D, { choice: 1, mutationId: M })).toEqual({ ok: false, code: 'conflict' })
  })
})

describe('listFactoryDeliveries — 지문 수와 문항 수를 따로', () => {
  it('같은 원문 3문항 = 지문 1', async () => {
    const row = (t: string, d: string) => ({ delivery_id: d, dcp_item_id: I, source_id: S, type: t, delivered_at: '2026-10-21T00:00:00Z', state: 'ok', attempts: 0, last_correct: null })
    const r = await listFactoryDeliveries(fake({ workspace_id: W, rows: [row('topic', D), row('title', M), row('main_point', W)] }), 'ws.reading')
    expect(r.ok && [r.list.sources, r.list.items]).toEqual([1, 3])
  })
  it.each([null, -1, '2', 1.5])('미상 시도 수 %j 를 0 으로 읽지 않는다 → bad_shape', async (attempts) => {
    const row = { delivery_id: D, dcp_item_id: I, source_id: S, type: 'topic', delivered_at: '2026-10-21T00:00:00Z', state: 'ok', attempts, last_correct: null }
    expect(await listFactoryDeliveries(fake({ workspace_id: W, rows: [row] }), 'ws.reading')).toEqual({ ok: false, code: 'bad_shape' })
  })
  it('잘못된 템플릿 · 모양', async () => {
    expect(await listFactoryDeliveries(fake({}), 'nope')).toEqual({ ok: false, code: 'invalid_input' })
    expect(await listFactoryDeliveries(fake({ workspace_id: W, rows: [{ x: 1 }] }), 'ws.reading')).toEqual({ ok: false, code: 'bad_shape' })
  })
})
