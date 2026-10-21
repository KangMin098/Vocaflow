// apps/web/src/app/api/admin/csat/product-order-lineage/route.test.ts
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  execute: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }))
vi.mock('@/lib/admin/product-order-lineage', () => ({
  executeProductOrderLineage: mocks.execute,
  readProductOrderLineage: mocks.read,
}))
import { GET, POST } from './route'
const UUID = '00000000-0000-4000-8000-000000000001'
const body = {
  action: 'withdraw',
  product_order_id: 'TPO-test',
  order_revision: 1,
  order_hash: 'a'.repeat(64),
  reason: 'test',
  request_key: UUID,
}
const req = (value: unknown = body, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/admin/csat/product-order-lineage', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ id: UUID, role: 'admin' })
  mocks.client.mockReturnValue({})
})
describe('주문 계보 API 인증과 결과', () => {
  it('로그인·역할·출처 검사가 서비스 클라이언트보다 먼저다', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({}, { status: 401 }))
    expect((await POST(req())).status).toBe(401)
    mocks.guard.mockResolvedValue({ id: UUID, role: 'curator' })
    expect((await POST(req())).status).toBe(403)
    mocks.guard.mockResolvedValue({ id: UUID, role: 'admin' })
    expect((await POST(req({}, { origin: 'http://elsewhere' }))).status).toBe(403)
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('JSON 형식·본문 크기를 제한하고 실패한 검증은 RPC 기록 성공으로 표시하지 않는다', async () => {
    expect((await POST(req({}, { 'content-type': 'text/plain' }))).status).toBe(415)
    expect((await POST(req({ text: 'x'.repeat(120001) }))).status).toBe(413)
    expect((await POST(req({}))).status).toBe(400)
    mocks.execute.mockRejectedValue(Error('connection lost after commit'))
    expect((await POST(req())).status).toBe(503)
  })
  it('기록된 과거 ID를 현재 승인이나 납품 완료로 바꾸지 않는다', async () => {
    mocks.execute.mockResolvedValue({ data: UUID, error: null })
    const response = await POST(req())
    expect(await response.json()).toEqual({
      recorded_id: UUID,
      current: 'read_required',
      delivery: 'not_performed',
    })
    expect(mocks.execute).toHaveBeenCalledWith({}, UUID, body)
  })
  it.each([
    ['42501', 403],
    ['PGRST202', 503],
    ['', 503],
    ['23505', 409],
    ['08006', 503],
    ['57014', 503],
    ['XX000', 503],
  ])('DB %s 결과를 HTTP %s로 구분한다', async (code, status) => {
    mocks.execute.mockResolvedValue({ data: null, error: { code } })
    expect((await POST(req())).status).toBe(status)
  })
  it('curator 조회는 허용하되 검증된 대상·Workspace를 그대로 읽는다', async () => {
    mocks.guard.mockResolvedValue({ id: UUID, role: 'curator' })
    mocks.read.mockResolvedValue({ status: 'not_installed' })
    const result = await GET(
      new NextRequest(
        `http://localhost/api/admin/csat/product-order-lineage?user=${UUID}&workspace=${UUID}`
      )
    )
    expect(await result.json()).toEqual({ status: 'not_installed' })
    expect(mocks.read).toHaveBeenCalledWith({}, UUID, UUID, UUID)
    expect(
      (
        await GET(
          new NextRequest('http://localhost/api/admin/csat/product-order-lineage?user=invalid')
        )
      ).status
    ).toBe(400)
  })
})
