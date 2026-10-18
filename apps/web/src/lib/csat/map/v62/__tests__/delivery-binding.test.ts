// apps/web/src/lib/csat/map/v62/__tests__/delivery-binding.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { bindDeliveryAttempt, bindingRequestKey } from '../delivery-binding'

type Res = { data: unknown; error: unknown }
function fake(tables: Record<string, Res>, rpc: Res = { data: 'wda-1', error: null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const filters: [string, string, unknown][] = []
  const client = {
    from(table: string) {
      const q = { select: () => q, eq: (k: string, v: unknown) => { filters.push([table, k, v]); return q }, order: () => q, limit: () => q,
        then: (r: (v: Res) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(r) }
      return q
    },
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve(rpc) },
  }
  return { db: client as unknown as SupabaseClient, calls, filters }
}
const IN = { userId: 'u1', itemRef: '2020#24', clientMutationId: 'm1' }

describe('bindDeliveryAttempt', () => {
  it('납품이 없으면 RPC 를 부르지 않는다', async () => {
    const f = fake({ workspace_content_delivery: { data: [], error: null } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'no_delivery' })
    expect(f.calls).toEqual([])
  })
  it('공급 원장이 없으면(미설치) not_installed', async () => {
    const f = fake({ workspace_content_delivery: { data: null, error: { code: '42P01' } } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'not_installed' })
  })
  it('본인 납품 · 같은 제출 id 시도 하나면 결속하고 요청 키는 제출 id 로 고정', async () => {
    const f = fake({ workspace_content_delivery: { data: [{ id: 'd1' }], error: null }, learning_task_attempts: { data: [{ id: 42 }], error: null } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'bound', id: 'wda-1' })
    expect(f.calls[0]).toEqual({ fn: 'workspace_delivery_attempt_record', args: { p_delivery: 'd1', p_attempt: 42, p_request_key: bindingRequestKey('u1', 'm1') } })
    // 조회는 본인 것만(user_id 필터) — 다른 학습자 납품을 고르지 않는다
    expect(f.filters).toContainEqual(['workspace_content_delivery', 'user_id', 'u1'])
    expect(f.filters).toContainEqual(['learning_task_attempts', 'user_id', 'u1'])
  })
  it('같은 제출 재시도는 같은 요청 키 · 다른 제출은 다른 키(UUID 형식)', () => {
    expect(bindingRequestKey('u1', 'm1')).toBe(bindingRequestKey('u1', 'm1'))
    expect(bindingRequestKey('u1', 'm2')).not.toBe(bindingRequestKey('u1', 'm1'))
    expect(bindingRequestKey('u1', 'm1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('시도 행이 없거나 둘 이상이면 추측하지 않고 error', async () => {
    for (const rows of [[], [{ id: 1 }, { id: 2 }]]) {
      const f = fake({ workspace_content_delivery: { data: [{ id: 'd1' }], error: null }, learning_task_attempts: { data: rows, error: null } })
      expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'error' })
      expect(f.calls).toEqual([])
    }
  })
  it('같은 요청 키 결속이 이미 있으면 새 납품을 고르지 않고 그 결속을 돌려준다', async () => {
    const f = fake({ workspace_delivery_attempt: { data: [{ id: 'wda-old' }], error: null }, workspace_content_delivery: { data: [{ id: 'd-new' }], error: null }, learning_task_attempts: { data: [{ id: 1 }], error: null } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'bound', id: 'wda-old' })
    expect(f.calls).toEqual([])
  })
  it('DB 가 거절하면(남의 납품 42501 · 첫 노출 경합 등) error — 기록은 그대로', async () => {
    const f = fake({ workspace_content_delivery: { data: [{ id: 'd1' }], error: null }, learning_task_attempts: { data: [{ id: 7 }], error: null } }, { data: null, error: { code: '42501' } })
    expect(await bindDeliveryAttempt(f.db, IN)).toEqual({ status: 'error' })
  })
})
