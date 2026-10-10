// apps/web/src/app/api/admin/csat/synthetic-production/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.auth }))
vi.mock('@/lib/csat/synthetic-production', () => ({
  SYNTHETIC_PRODUCTION_ORDERS: ['m1', 'h1', 'm1-m2'], runAdminSyntheticProduction: mocks.run,
}))
import { POST } from './route'
const request = (body: unknown) => new Request('http://localhost/api/admin/csat/synthetic-production',
  { method: 'POST', body: JSON.stringify(body) })

describe('admin synthetic production API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'admin', role: 'admin' })
    mocks.run.mockResolvedValue({ html: '<!-- synthetic_fixture=true non_production=true -->',
      manifest: { synthetic_fixture: true, non_production: true, production_verified: false } })
  })
  it('rejects unauthenticated and curator requests before executing any factory code', async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
    expect((await POST(request({ order: 'm1' }))).status).toBe(403)
    mocks.auth.mockResolvedValue({ id: 'curator', role: 'curator' })
    expect((await POST(request({ order: 'm1' }))).status).toBe(403)
    expect(mocks.run).not.toHaveBeenCalled()
  })
  it('does not accept a real order, path or caller evidence as simulation input', async () => {
    for (const body of [{ order: 'real-order' }, { order: 'm1', evidence: {} }, { order: 'm1', path: 'data' }, []])
      expect((await POST(request(body))).status).toBe(400)
    expect(mocks.run).not.toHaveBeenCalled()
  })
  it('returns marked output without caching or changing database state', async () => {
    const response = await POST(request({ order: 'm1-m2' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.run).toHaveBeenCalledWith('m1-m2')
    expect((await response.json()).manifest.production_verified).toBe(false)
  })
  it('returns no partial output or internal error detail when the run fails', async () => {
    mocks.run.mockRejectedValue(Error('sensitive internal detail'))
    const response = await POST(request({ order: 'm1' }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'SYNTHETIC_PRODUCTION_FAILED' })
  })
})
