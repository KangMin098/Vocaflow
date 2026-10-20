// apps/web/src/lib/csat/map/v62/__tests__/delivery-binding.test.ts
// R5 §6 · FI-001(#293) — 결속은 화면이 연 납품(명시 id)에만. 최신 납품 추측 없음 · 역할 불일치 결속 없음 · 재전송 멱등.
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { bindDeliveryAttempt, bindingRequestKey, shapeFitsRole } from '../delivery-binding'

type Res = { data: unknown; error: unknown }
type Table = Res | ((f: [string, unknown][]) => Res)
const D1 = '11111111-1111-4111-8111-111111111111'
function fake(tables: Record<string, Table>, rpc: Res = { data: 'wda-1', error: null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const filters: [string, string, unknown][] = []
  const client = {
    from(table: string) {
      const mine: [string, unknown][] = []
      const q = { select: () => q, eq: (k: string, v: unknown) => { filters.push([table, k, v]); mine.push([k, v]); return q }, order: () => q, limit: () => q,
        then: (r: (v: Res) => unknown) => { const t = tables[table]; return Promise.resolve(typeof t === 'function' ? t(mine) : t ?? { data: [], error: null }).then(r) } }
      return q
    },
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve(rpc) },
  }
  return { db: client as unknown as SupabaseClient, calls, filters }
}
const IN = { userId: 'u1', itemRef: '2020#24', clientMutationId: 'm1' }
const DELIVERY = { id: D1, role: 'independent_check', workspace_id: 'w1', artifact_kind: 'csat_item', artifact_ref: '2020#24' }
const ATTEMPT = { id: 42, activity: 'theater', phase: 'practice', help_level: 'independent' }
const happy = (over: Record<string, Table> = {}) => fake({
  workspace_content_delivery: { data: [DELIVERY], error: null },
  learner_workspace: { data: [{ id: 'w1' }], error: null },
  learning_task_attempts: { data: [ATTEMPT], error: null },
  workspace_delivery_attempt: (f) => (f.some(([k]) => k === 'request_key') ? { data: [], error: null }
    : { data: [{ id: 'wda-1', delivery_id: D1, evidence: true, non_evidence_reason: null }], error: null }),
  ...over,
})

describe('bindDeliveryAttempt — 출처 없음', () => {
  it('납품 id 가 없으면 결속하지 않는다 — 납품이 있으면 no_provenance(복구 가능), 없으면 no_delivery', async () => {
    const withDelivery = happy()
    expect(await bindDeliveryAttempt(withDelivery.db, IN)).toEqual({ status: 'no_provenance' })
    expect(withDelivery.calls).toEqual([])
    const none = happy({ workspace_content_delivery: { data: [], error: null } })
    expect(await bindDeliveryAttempt(none.db, IN)).toEqual({ status: 'no_delivery' })
  })
  it('공급 원장이 없으면(미설치) not_installed', async () => {
    const f = fake({ workspace_delivery_attempt: { data: null, error: { code: '42P01' } } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'not_installed' })
  })
})

describe('bindDeliveryAttempt — 명시 납품', () => {
  it('본인 납품 · 같은 문항 · active Workspace · 맞는 시도 모양 → 그 납품에 결속 · 근거 여부를 돌려준다', async () => {
    const f = happy()
    expect(await bindDeliveryAttempt(f.db, { ...IN, deliveryId: D1 })).toEqual({ status: 'bound', id: 'wda-1', deliveryId: D1, evidence: true, reason: null })
    expect(f.calls[0]).toEqual({ fn: 'workspace_delivery_attempt_record', args: { p_delivery: D1, p_attempt: 42, p_request_key: bindingRequestKey('u1', 'm1') } })
    expect(f.filters).toContainEqual(['workspace_content_delivery', 'id', D1])
    expect(f.filters).toContainEqual(['workspace_content_delivery', 'user_id', 'u1'])
    expect(f.filters).toContainEqual(['learner_workspace', 'status', 'active'])
  })
  it('남의 · 없는 납품, 다른 문항 · 종류, 닫힌 Workspace, 형식 밖 id = invalid_delivery(RPC 안 부름)', async () => {
    for (const f of [
      happy({ workspace_content_delivery: { data: [], error: null } }),
      happy({ workspace_content_delivery: { data: [{ ...DELIVERY, artifact_ref: '2021#24' }], error: null } }),
      happy({ workspace_content_delivery: { data: [{ ...DELIVERY, artifact_kind: 'authored_item' }], error: null } }),
      happy({ learner_workspace: { data: [], error: null } }),
    ]) {
      expect(await bindDeliveryAttempt(f.db, { ...IN, deliveryId: D1 })).toEqual({ status: 'invalid_delivery' })
      expect(f.calls).toEqual([])
    }
    expect(await bindDeliveryAttempt(happy().db, { ...IN, deliveryId: 'not-a-uuid' })).toEqual({ status: 'invalid_delivery' })
  })
  it('혼자 확인 시도를 전이 납품에 · 전이 시도를 혼자 확인 납품에 결속하지 않는다(role_mismatch · 기록 보존)', async () => {
    const toTransfer = happy({ workspace_content_delivery: { data: [{ ...DELIVERY, role: 'transfer' }], error: null } })
    expect(await bindDeliveryAttempt(toTransfer.db, { ...IN, deliveryId: D1 })).toEqual({ status: 'role_mismatch', deliveryId: D1 })
    expect(toTransfer.calls).toEqual([])
    const transferAttempt = happy({ learning_task_attempts: { data: [{ ...ATTEMPT, phase: 'transfer' }], error: null } })
    expect((await bindDeliveryAttempt(transferAttempt.db, { ...IN, deliveryId: D1 })).status).toBe('role_mismatch')
  })
  it('시도 행이 없거나 둘 이상이면 추측하지 않고 error', async () => {
    for (const rows of [[], [ATTEMPT, { ...ATTEMPT, id: 43 }]]) {
      const f = happy({ learning_task_attempts: { data: rows, error: null } })
      expect((await bindDeliveryAttempt(f.db, { ...IN, deliveryId: D1 })).status).toBe('error')
      expect(f.calls).toEqual([])
    }
  })
  it('DB 가 거절하면 error — 기록은 그대로', async () => {
    const f = fake({ workspace_content_delivery: { data: [DELIVERY], error: null }, learner_workspace: { data: [{ id: 'w1' }], error: null }, learning_task_attempts: { data: [ATTEMPT], error: null } }, { data: null, error: { code: '42501' } })
    expect((await bindDeliveryAttempt(f.db, { ...IN, deliveryId: D1 })).status).toBe('error')
  })
})

describe('재전송 · 시도 모양', () => {
  it('같은 요청 키 결속이 이미 있으면 다른 납품을 지정해도 처음 결속을 돌려준다(이력 불변)', async () => {
    const f = happy({ workspace_delivery_attempt: { data: [{ id: 'wda-old', delivery_id: 'd-old', evidence: false, non_evidence_reason: 'help_state_mismatch' }], error: null } })
    expect(await bindDeliveryAttempt(f.db, { ...IN, deliveryId: D1 })).toEqual({ status: 'bound', id: 'wda-old', deliveryId: 'd-old', evidence: false, reason: 'help_state_mismatch' })
    expect(f.calls).toEqual([])
  })
  it('같은 제출 재시도는 같은 요청 키 · 다른 제출은 다른 키(UUID 형식)', () => {
    expect(bindingRequestKey('u1', 'm1')).toBe(bindingRequestKey('u1', 'm1'))
    expect(bindingRequestKey('u1', 'm2')).not.toBe(bindingRequestKey('u1', 'm1'))
    expect(bindingRequestKey('u1', 'm1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('shapeFitsRole: DB 도움 상태 규칙과 같은 대응', () => {
    const ind = { activity: 'theater', phase: 'practice', help_level: 'independent' }
    const tr = { activity: 'theater', phase: 'transfer', help_level: 'independent' }
    const pr = { activity: 'practice', phase: 'practice', help_level: 'independent' }
    const helped = { activity: 'theater', phase: 'practice', help_level: 'viewed_first' }
    expect([shapeFitsRole('independent_check', ind), shapeFitsRole('delayed_check', ind), shapeFitsRole('transfer', ind)]).toEqual([true, true, false])
    expect([shapeFitsRole('transfer', tr), shapeFitsRole('independent_check', tr)]).toEqual([true, false])
    expect([shapeFitsRole('guided_practice', pr), shapeFitsRole('model_explanation', pr), shapeFitsRole('independent_check', pr)]).toEqual([true, true, false])
    expect(shapeFitsRole('independent_check', helped)).toBe(true) // 도움 받은 시도는 결속하되 DB 가 비근거로 남긴다
  })
})
