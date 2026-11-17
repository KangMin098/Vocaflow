// apps/web/src/app/api/admin/csat/factory-order-draft/route.test.ts
// 실제 route 배선 — 가드와 서비스 롤 클라이언트 생성만 대역. 서비스 · 공장 함수는 실물이다.
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fixtureState, requestBody, stubReader } from '@/lib/admin/__tests__/factory-order-draft.fixture'

const mocks = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }))
vi.mock('@/lib/admin/factory-order-draft', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/admin/factory-order-draft')>()
  // DB 클라이언트 → reader 변환만 시험 대역으로 바꾼다
  return { ...real, supabaseFactoryOrderDraftReader: () => stubReader(fixtureState()).reader }
})

import { POST } from './route'

const req = (value: unknown, origin = 'http://localhost') =>
  new NextRequest('http://localhost/api/admin/csat/factory-order-draft', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', email: null, role: 'admin' })
  mocks.client.mockReturnValue({})
})

describe('factory-order-draft route', () => {
  it('가드 · 역할 · 출처 실패에서는 서비스 롤 클라이언트를 만들지 않는다', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({}, { status: 401 }))
    expect((await POST(req(requestBody()))).status).toBe(401)
    mocks.guard.mockResolvedValue({ id: 'x', email: null, role: 'curator' })
    expect((await POST(req(requestBody()))).status).toBe(403)
    mocks.guard.mockResolvedValue({ id: 'x', email: null, role: 'admin' })
    expect((await POST(req(requestBody(), 'http://elsewhere'))).status).toBe(403)
    expect((await POST(req({ ...requestBody(), user_id: 'x' }))).status).toBe(400)
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('관리자 정상 요청은 실제 공장 초안을 비영속으로 돌려준다', async () => {
    const response = await POST(req(requestBody()))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ status: 'draft_prepared', persisted: false, production: 'not_started', delivery: 'not_performed' })
    expect(body.factory.order_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(mocks.client).toHaveBeenCalledTimes(1)
  })
})
