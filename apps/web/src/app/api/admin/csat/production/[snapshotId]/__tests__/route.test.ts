// apps/web/src/app/api/admin/csat/production/[snapshotId]/__tests__/route.test.ts
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const { guard, client, rpc } = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: client }))
import { GET } from '../route'

const id = '123e4567-e89b-42d3-a456-426614174000'
const html = '<html><body>Verified textbook</body></html>'
const outputHash = createHash('sha256').update(html).digest('hex')
const context = { params: { snapshotId: id } }
const request = new Request(`http://localhost/api/admin/csat/production/${id}`)

beforeEach(() => {
  guard.mockReset().mockResolvedValue({})
  client.mockReset().mockReturnValue({ rpc })
  rpc.mockReset().mockResolvedValue({ data: {
    snapshot_id: id, snapshot_hash: 'a'.repeat(64), output_hash: outputHash, html,
  }, error: null })
})

it('checks admin access before creating the service client', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
  expect((await GET(request, context)).status).toBe(403)
  expect(client).not.toHaveBeenCalled()
})

it('downloads only the DB-revalidated exact artifact without cache or active same-origin HTML', async () => {
  const result = await GET(request, context)
  expect(result.status).toBe(200)
  expect(await result.text()).toBe(html)
  expect(rpc).toHaveBeenCalledWith('serve_reading_production_artifact', { p_snapshot_id: id })
  expect(result.headers.get('cache-control')).toContain('no-store')
  expect(result.headers.get('content-disposition')).toContain('attachment')
  expect(result.headers.get('content-security-policy')).toContain('sandbox')
  expect(result.headers.get('x-output-hash')).toBe(outputHash)
})

it('fails closed on invalid ID, revoked DB evidence, mixed snapshot, or changed HTML', async () => {
  expect((await GET(request, { params: { snapshotId: 'bad' } })).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValueOnce({ data: null, error: { code: '23514' } })
  expect((await GET(request, context)).status).toBe(409)
  rpc.mockResolvedValueOnce({ data: { snapshot_id: 'other', snapshot_hash: 'a'.repeat(64),
    output_hash: outputHash, html }, error: null })
  expect((await GET(request, context)).status).toBe(409)
  rpc.mockResolvedValueOnce({ data: { snapshot_id: id, snapshot_hash: 'a'.repeat(64),
    output_hash: outputHash, html: `${html}changed` }, error: null })
  expect((await GET(request, context)).status).toBe(409)
})
