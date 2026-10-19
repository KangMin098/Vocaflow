// apps/web/src/lib/admin/__tests__/product-order-lineage.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { executeProductOrderLineage, readProductOrderLineage } from '../product-order-lineage'
import { lineageOrder } from '@/lib/csat/map/v62/__tests__/order-lineage.fixture'
import {
  assertRegistryProfile,
  prepareLineageRegistration,
  specFromDemand,
} from '@/lib/csat/map/v62/factory-bridge/order-lineage'

const UUID = '00000000-0000-4000-8000-000000000001'
const canonical = JSON.stringify({
  v: 2,
  definitionVersion: 'v6.2',
  lines: [
    {
      task: 'r.central_meaning',
      role: 'guided_practice',
      types: ['R-TOPIC'],
      keys: [],
      requires: {},
    },
  ],
})
const spec = specFromDemand(canonical, 0)
const command = () => ({
  action: 'register',
  ...lineageOrder(),
  spec,
  quantity: 2,
  reason: 'test',
  request_key: UUID,
})
const db = (data: unknown = null, error: unknown = null) => {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}
describe('Product Order 정본 게이트와 읽기', () => {
  it('정본을 다시 검증하고 고정 sealed_at 원문을 그대로 RPC에 전달한다', async () => {
    const { order, order_hash } = lineageOrder()
    const sealed = { order, order_hash }
    const body = {
      action: 'register',
      ...sealed,
      spec,
      quantity: 2,
      reason: 'test',
      request_key: UUID,
    }
    const f = db('TPO-test')
    await executeProductOrderLineage(f.client, UUID, body)
    const params = f.rpc.mock.calls[0][1]
    expect(JSON.parse(params.p_canonical).sealed_at).toBe('2026-10-20T00:00:00Z')
    expect(params.p_actor).toBe(UUID)
    expect(params.p_hash).toBe(sealed.order_hash)
  })
  it('변조·잘못된 family/target·정수 외 값은 DB 호출 전에 거절한다', async () => {
    const { order, order_hash } = lineageOrder()
    const sealed = { order, order_hash }
    const base = {
      action: 'register',
      ...sealed,
      spec,
      quantity: 2,
      reason: 'test',
      request_key: UUID,
    }
    const f = db()
    await expect(
      executeProductOrderLineage(f.client, UUID, { ...base, order_hash: '0'.repeat(64) })
    ).rejects.toThrow('hash_mismatch')
    await expect(
      executeProductOrderLineage(f.client, UUID, {
        ...base,
        order: { ...base.order, product_family: 'P20' },
      })
    ).rejects.toThrow()
    expect(() => assertRegistryProfile({ mix: 0.5 })).toThrow('integer_required')
    expect(() => assertRegistryProfile({ '1': 1 })).toThrow('ascii_key_required')
    expect(f.rpc).not.toHaveBeenCalled()
  })
  it('학습자·개인 수량·메모를 공용 spec으로 옮기지 않는다', () => {
    const a = JSON.parse(canonical)
    a.user = 'private'
    a.lines[0].n = 20
    a.lines[0].reason = 'private'
    expect(specFromDemand(JSON.stringify(a), 0)).toEqual(spec)
    a.lines[0].requires.gold = true
    expect(specFromDemand(JSON.stringify(a), 0)).not.toEqual(spec)
    expect(() => prepareLineageRegistration(command())).toThrow() // capability_state is not part of the command contract
  })
  it.each(['PGRST202'])('미설치 %s는 명시하고 오류를 0건으로 바꾸지 않는다', async (code) => {
    const f = db(null, { code })
    expect(await readProductOrderLineage(f.client, UUID, UUID, UUID)).toEqual({
      status: 'not_installed',
    })
  })
  it.each([
    null,
    {},
    { rows: [], total: 2, limited: false },
    { rows: [], total: 0, limited: true },
  ])('잘못된 읽기 결과는 조회 불가다: %j', async (data) => {
    expect(await readProductOrderLineage(db(data).client, UUID, UUID, UUID)).toEqual({
      status: 'error',
    })
  })
  it('실제 빈 원장과 권한/네트워크 오류를 구분한다', async () => {
    expect(
      await readProductOrderLineage(db(null, { code: '42883' }).client, UUID, UUID, UUID)
    ).toEqual({ status: 'error' })
    const f = db({ rows: [], total: 0, limited: false })
    expect(await readProductOrderLineage(f.client, UUID, 'target', 'workspace')).toEqual({
      status: 'installed',
      rows: [],
      total: 0,
      limited: false,
    })
    expect(f.rpc).toHaveBeenCalledWith('factory_lineage_read', {
      p_actor: UUID,
      p_user: 'target',
      p_workspace: 'workspace',
    })
    expect(
      await readProductOrderLineage(db(null, { code: '42501' }).client, UUID, UUID, UUID)
    ).toEqual({ status: 'error' })
  })
})
