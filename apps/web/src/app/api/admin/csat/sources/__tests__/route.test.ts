// apps/web/src/app/api/admin/csat/sources/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const { guard, create, chain } = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn(), chain: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: create }))
import { GET, POST } from '../route'
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ id: 'admin' }); create.mockReturnValue({ from: chain }) })
it('GET and POST refuse before service access when admin guard fails', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  expect((await GET(new Request('http://localhost/api/admin/csat/sources'))).status).toBe(403)
  expect((await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST' }))).status).toBe(403)
  expect(create).not.toHaveBeenCalled()
})
it('rejects cross-origin cache writes before parsing or service access', async () => {
  const r = await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST', headers: { origin: 'https://untrusted.example' }, body: '{}' }))
  expect(r.status).toBe(403); expect(create).not.toHaveBeenCalled()
})
it.each(['?queue=constructor', '?id=not-a-uuid', '?page=-1'])('invalid filter %s is an error, not an empty success', async suffix => {
  expect((await GET(new Request('http://localhost/api/admin/csat/sources' + suffix))).status).toBe(400)
  expect(chain).not.toHaveBeenCalled()
})
it('missing count is not interpreted as zero inventory', async () => {
  const q = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], count: null, error: null }) }
  chain.mockReturnValue(q)
  const response = await GET(new Request('http://localhost/api/admin/csat/sources?queue=all'))
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
})
