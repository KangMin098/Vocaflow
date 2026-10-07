// apps/web/src/app/api/admin/articles/reading-promotion/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(), createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
import { POST } from './route'

const send = (body: unknown) => POST(new Request('http://localhost/api/admin/articles/reading-promotion', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))

describe('reading promotion admin authorization route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminApi.mockResolvedValue({ id: 'admin-1', role: 'admin' })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'approved' }, error: null })
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc })
  })

  it('rejects curator and development bypass without a real matching session', async () => {
    mocks.requireAdminApi.mockResolvedValueOnce({ id: 'curator-1', role: 'curator' })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'A long enough rationale.' })).status).toBe(403)
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'A long enough rationale.' })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('passes only the selected authenticated-admin RPC fields', async () => {
    const response = await send({ action: 'approve', p_request: { request_id: 'fixture' }, p_rationale: 'The complete order and evidence were reviewed.' })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('approve_reading_promotion', { p_request: { request_id: 'fixture' }, p_rationale: 'The complete order and evidence were reviewed.' })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'long rationale', extra: true })).status).toBe(400)
    expect((await send({ action: 'toString' })).status).toBe(400)
  })
})
