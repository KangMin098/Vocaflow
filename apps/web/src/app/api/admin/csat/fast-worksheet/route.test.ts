// apps/web/src/app/api/admin/csat/fast-worksheet/route.test.ts
// 인증 · 출처 · 크기 · 닫힌 본문 · 원천 조회 실패/없음 · 실제 판정 결과(evaluateFast 는 mock 하지 않는다)
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FAST_BUNDLE_SCHEMA } from '@/lib/csat/map/v62/factory-bridge/fast-worksheet'
import { outputOf, packetOf, snapshot } from '@/lib/csat/map/v62/factory-bridge/__tests__/dcp-fixture'

const mocks = vi.hoisted(() => ({ guard: vi.fn(), service: vi.fn(), reader: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.service }))
vi.mock('@/lib/admin/dcp-admission', () => ({ currentSourceReader: mocks.reader }))
import { POST } from './route'

const post = (b: unknown, h: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/admin/csat/fast-worksheet', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json', ...h },
    body: typeof b === 'string' ? b : JSON.stringify(b),
  })
async function bundle() {
  const packet = await packetOf(true, snapshot())
  return { schema: FAST_BUNDLE_SCHEMA, packet, base_output: outputOf(packet), source_snapshot: snapshot(), edit: null, review: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ id: 'admin-1', role: 'admin' })
  mocks.reader.mockReturnValue(mocks.read)
  mocks.read.mockResolvedValue(snapshot())
})

describe('fast-worksheet route', () => {
  it('guard 응답을 그대로 돌려주고 원천을 읽지 않는다', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({}, { status: 401 }))
    expect((await POST(post({ action: 'preview', bundle: await bundle() }))).status).toBe(401)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('출처 · JSON · 크기 · 닫힌 본문을 검증한다', async () => {
    const b = await bundle()
    expect((await POST(post({ action: 'preview', bundle: b }, { origin: 'http://evil' }))).status).toBe(403)
    expect((await POST(post({ action: 'preview', bundle: b }, { 'content-type': 'text/plain' }))).status).toBe(415)
    expect((await POST(post({ action: 'preview', bundle: { pad: '가'.repeat(200001) } }))).status).toBe(413)
    expect((await POST(post({ action: 'preview', bundle: b, current: snapshot() }))).status).toBe(400)
    expect((await POST(post({ action: 'admit', bundle: b }))).status).toBe(400)
    expect((await POST(post('{'))).status).toBe(400)
  })

  it('원천 조회 실패는 503(재시도 안내) · 없는 원천은 409 — 빈 값으로 통과시키지 않는다', async () => {
    const b = await bundle()
    mocks.read.mockRejectedValueOnce(new Error('source_read_failed'))
    expect((await POST(post({ action: 'preview', bundle: b }))).status).toBe(503)
    mocks.read.mockResolvedValueOnce(null)
    const missing = await POST(post({ action: 'preview', bundle: b }))
    expect(missing.status).toBe(409)
    expect(await missing.json()).toMatchObject({ code: 'source_current_missing' })
  })

  it('현재 원천으로 실제 판정해 DTO 를 돌려준다 · 원천이 바뀌면 거절 · no-store', async () => {
    const b = await bundle()
    const ok = await POST(post({ action: 'preview', bundle: b }))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    const body = await ok.json()
    expect(body).toMatchObject({ status: 'ok', writes: 'not_performed', view: { review: { status: 'review_required' }, student_html: null } })
    expect(mocks.read).toHaveBeenCalledWith(b.packet.body.source.id)
    mocks.read.mockResolvedValueOnce(snapshot({ license: 'CC-BY-4.0' }))
    const changed = await POST(post({ action: 'export', bundle: b }))
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({ code: 'source_changed', detail: ['license'] })
    const exp = await (await POST(post({ action: 'export', bundle: b }))).json()
    expect(exp.files.map((f: { name: string }) => f.name)).toEqual(['edited-output.json', 'review-request.json'])
  })
})
