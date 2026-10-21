// apps/web/src/app/api/admin/csat/dcp-admission/route.test.ts
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  service: vi.fn(),
  session: vi.fn(),
  preview: vi.fn(),
  admit: vi.fn(),
  reader: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.service }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.session }))
vi.mock('@/lib/admin/dcp-admission', () => ({
  previewDcpAdmission: mocks.preview,
  admitDcpCandidates: mocks.admit,
  currentSourceReader: mocks.reader,
}))
import { POST } from './route'

const body = (o: Record<string, unknown> = {}) => ({ action: 'preview', packet: { a: 1 }, output: { b: 1 }, output_sha256: 'a'.repeat(64), review: { c: 1 }, ...o })
const post = (b: unknown, h: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/admin/csat/dcp-admission', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json', ...h },
    body: typeof b === 'string' ? b : JSON.stringify(b),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ id: 'admin-1', role: 'admin' })
  mocks.service.mockReturnValue({ service: true })
  mocks.session.mockResolvedValue({ session: true })
  mocks.reader.mockReturnValue('reader')
  mocks.preview.mockResolvedValue({ status: 'ok', plan: { items: [], real_admissible: false }, writes: 'not_performed' })
  mocks.admit.mockResolvedValue({ status: 'not_installed' })
})

describe('dcp-admission route', () => {
  it('guard 응답을 그대로 돌려준다', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({}, { status: 401 }))
    expect((await POST(post(body()))).status).toBe(401)
    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it('출처 · JSON · 크기 · 형식을 검증하고 no-store', async () => {
    expect((await POST(post(body(), { origin: 'http://evil' }))).status).toBe(403)
    expect((await POST(post(body(), { 'content-type': 'text/plain' }))).status).toBe(415)
    expect((await POST(post(JSON.stringify(body({ review: { pad: 'x'.repeat(400001) } }))))).status).toBe(413)
    expect((await POST(post(body({ userId: 'x' })))).status).toBe(400)
    expect((await POST(post(body({ output_sha256: 'z' })))).status).toBe(400)
    expect((await POST(post(body({ rights: { record_id: 'r', basis: 'b', actor: 'x' } })))).status).toBe(400)
    expect((await POST(post('{'))).status).toBe(400)
    const ok = await POST(post(body()))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect(await ok.json()).toMatchObject({ writes: 'not_performed' })
  })

  it('preview 는 service 로 원천만 읽고 세션 RPC 를 만들지 않는다 · curator 도 가능', async () => {
    mocks.guard.mockResolvedValue({ id: 'c-1', role: 'curator' })
    await POST(post(body()))
    expect(mocks.reader).toHaveBeenCalledWith({ service: true }, expect.any(Date))
    expect(mocks.preview).toHaveBeenCalledWith('reader', expect.objectContaining({ outputSha256: 'a'.repeat(64), rights: null }))
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.admit).not.toHaveBeenCalled()
  })

  it('admit 은 admin 만 · 관리자 세션 클라이언트로 · 미설치는 503 not_installed', async () => {
    mocks.guard.mockResolvedValue({ id: 'c-1', role: 'curator' })
    expect((await POST(post(body({ action: 'admit' })))).status).toBe(403)
    mocks.guard.mockResolvedValue({ id: 'admin-1', role: 'admin' })
    const r = await POST(post(body({ action: 'admit' })))
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ status: 'not_installed' })
    expect(mocks.admit).toHaveBeenCalledWith({ session: true }, 'reader', expect.anything())
  })

  it('거절은 409 · 예외는 503', async () => {
    mocks.admit.mockResolvedValue({ status: 'rejected', code: 'not_admissible' })
    expect((await POST(post(body({ action: 'admit' })))).status).toBe(409)
    mocks.preview.mockRejectedValue(new Error('x'))
    expect((await POST(post(body()))).status).toBe(503)
  })
})
