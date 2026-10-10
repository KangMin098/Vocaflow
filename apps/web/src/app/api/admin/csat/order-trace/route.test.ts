// apps/web/src/app/api/admin/csat/order-trace/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ requireAdminApi: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from './route'

describe('admin order trace API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminApi.mockResolvedValue({ id: 'admin-one', role: 'admin' })
  })

  it('rejects non-admin calls before reading the database', async () => {
    mocks.requireAdminApi.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    const response = await GET(new Request('http://localhost/api/admin/csat/order-trace?order_id=one'))
    expect(response.status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('returns a missing order as unmeasured, not as zero completed steps', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }) })
    const response = await GET(new Request('http://localhost/api/admin/csat/order-trace?order_id=one'))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.entries).toHaveLength(14)
    expect(data.entries.every((row: { state: string }) => row.state === 'unmeasured')).toBe(true)
    expect(data.blocker).toMatch(/주문/)
  })

  it('fails closed when the order lookup fails', async () => {
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: Error('db unavailable') }) }) }),
    }) })
    const response = await GET(new Request('http://localhost/api/admin/csat/order-trace?order_id=one'))
    expect(response.status).toBe(503)
  })
})
