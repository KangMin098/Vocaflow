// apps/web/src/app/api/admin/methodology/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.auth }))
vi.mock('@/lib/methodology/server', () => ({ readMethodologySnapshot: mocks.read }))
import { GET } from './route'
const request = (query = '') => new NextRequest(`https://example.org/api/admin/methodology${query}`)
describe('methodology admin API boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: 'admin', role: 'admin' }) })
  it.each([401, 403])('denies %i before storage or research access', async status => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: 'denied' }, { status }))
    expect((await GET(request('?mode=research'))).status).toBe(status)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('exposes research only as explicit, labeled preview', async () => {
    const response = await GET(request('?mode=research'))
    const body = await response.json()
    expect(body.mode).toBe('research'); expect(body.notice).toContain('DB 적재')
    expect(body.bundle.methods.every((m: { review: string }) => m.review === 'extracted')).toBe(true)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('returns failure instead of silently substituting research data', async () => {
    mocks.read.mockRejectedValue(new Error('storage unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { const response = await GET(request()); expect(response.status).toBe(503); expect((await response.json()).bundle).toBeUndefined() } finally { log.mockRestore() }
  })
  it('distinguishes empty storage from failure', async () => {
    mocks.read.mockResolvedValue(null)
    expect((await (await GET(request())).json()).status).toBe('empty')
  })
  it('rejects malformed snapshot ids before DB access', async () => {
    expect((await GET(request('?id=not-a-hash'))).status).toBe(400)
    expect(mocks.read).not.toHaveBeenCalled()
  })
})
