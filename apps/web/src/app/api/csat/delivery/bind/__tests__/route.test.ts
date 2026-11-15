// apps/web/src/app/api/csat/delivery/bind/__tests__/route.test.ts — T-0075: 다시 연결하기 응답의 수행 id 는 본인 결속 행에서만 · 특정 불가 = null
import { beforeEach, describe, expect, it, vi } from 'vitest'

const bindDeliveryAttempt = vi.fn()
const boundAttemptId = vi.fn()
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ db: {}, userId: 'u1' }),
  readJson: async (req: Request) => req.json(),
  failure: (e: unknown) => new Response(String(e), { status: 500 }),
}))
vi.mock('@/lib/csat/map/v62/delivery-binding', () => ({
  bindDeliveryAttempt: (...a: unknown[]) => bindDeliveryAttempt(...a),
  boundAttemptId: (...a: unknown[]) => boundAttemptId(...a),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ learner: true }) }))

const CMID = '33333333-3333-4333-8333-333333333333'
const DID = '11111111-1111-4111-8111-111111111111'
const post = async (body: unknown) => {
  const { POST } = await import('../route')
  return POST(new Request('http://x/api/csat/delivery/bind', { method: 'POST', body: JSON.stringify(body) }))
}

describe('POST /api/csat/delivery/bind — 복구 응답(T-0075)', () => {
  beforeEach(() => { bindDeliveryAttempt.mockReset(); boundAttemptId.mockReset() })
  it('결속 성공 → 같은 학습자 세션 · 본인 user_id · 그 결속 결과로 수행 id 를 읽어 함께 돌려준다', async () => {
    const binding = { status: 'bound', id: '22222222-2222-4222-8222-222222222222', evidence: true, reason: null }
    bindDeliveryAttempt.mockResolvedValue(binding); boundAttemptId.mockResolvedValue('41')
    const r = await post({ kind: 'authored_item', itemRef: 'authored:x', clientMutationId: CMID, deliveryId: DID })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ binding, attemptId: '41' })
    expect(bindDeliveryAttempt.mock.calls[0][1]).toMatchObject({ userId: 'u1', clientMutationId: CMID, deliveryId: DID, artifactKind: 'authored_item' })
    expect(boundAttemptId).toHaveBeenCalledWith(bindDeliveryAttempt.mock.calls[0][0], 'u1', binding)
  })
  it('결속 실패 · 특정 불가 → attemptId null(클라이언트 값 · 최근 자료로 채우지 않는다)', async () => {
    bindDeliveryAttempt.mockResolvedValue({ status: 'error' }); boundAttemptId.mockResolvedValue(null)
    const r = await post({ kind: 'authored_item', itemRef: 'authored:x', clientMutationId: CMID, deliveryId: DID, attemptId: '99' })
    expect(await r.json()).toEqual({ binding: { status: 'error' }, attemptId: null })
  })
  it('입력이 모자라면 400 · 결속을 부르지 않는다', async () => {
    const r = await post({ kind: 'authored_item', itemRef: 'authored:x', clientMutationId: CMID })
    expect(r.status).toBe(400)
    expect(bindDeliveryAttempt).not.toHaveBeenCalled()
  })
})
