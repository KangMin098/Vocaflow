// apps/web/src/app/api/csat/factory/__tests__/factory-request.test.ts
// 2F 요청 API — 실제 route handler. 대역(명시): 로그인 · 지도 읽기 · 계산 · 공급 서비스. 실제 SQL 경로는 reassess-plan.pglite.test.ts.
// 여기서는 로그인 · 출처 · 형식 · 바이트 상한 · 학습 묶음 범위 · 오류/미설치 매핑과 클라이언트 응답 파서만 본다.
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ loggedIn: true, saved: true as boolean, request: vi.fn() }))
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => (state.loggedIn ? { userId: 'u', email: null, db: { service: true } } : NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ session: true }) }))
vi.mock('@/lib/csat/map/load', () => ({
  loadMapPage: async () => ({ model: { goal: 80, goalSet: true }, v4: { saved: { goalVersionId: 7, byTemplate: state.saved ? { 'ws.central-meaning': { workspaceId: 'w', latest: { version: 2 } } } : {} } } }),
}))
vi.mock('@/lib/csat/map/v4/compose', () => ({ composeV4: () => ({ view: true }) }))
vi.mock('@/lib/csat/map/v62/factory-bridge/dcp-request', () => ({ FACTORY_TASK: 'r.central_meaning', requestFactoryDcp: state.request }))

import { POST } from '../request/route'
import { readFactoryRequest } from '@/components/csat/diagnosis/map/FactoryDcpCard'

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(new Request('https://vocaflow.test/api/csat/factory/request', { method: 'POST', body, headers: { origin: 'https://vocaflow.test', 'content-type': 'application/json', ...headers } }))
const ok = JSON.stringify({ template: 'ws.central-meaning' })

beforeEach(() => {
  state.loggedIn = true
  state.saved = true
  state.request.mockReset()
  state.request.mockResolvedValue({ status: 'waiting_link' })
})

describe('POST /api/csat/factory/request', () => {
  it('로그인 · 출처 · 형식 · 크기 · 닫힌 키 — 서비스 호출 전 거절', async () => {
    state.loggedIn = false
    expect((await post(ok)).status).toBe(401)
    state.loggedIn = true
    expect((await post(ok, { origin: 'https://evil.test' })).status).toBe(403)
    expect((await post(ok, { 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post(JSON.stringify({ template: 'x'.repeat(2000) }))).status).toBe(413)
    for (const b of ['{', '[]', '{}', JSON.stringify({ template: 1 }), JSON.stringify({ template: 'ws.central-meaning', userId: 'v' }), JSON.stringify({ template: 'WS' })]) {
      expect((await post(b)).status, b).toBe(400)
    }
    expect((await post(JSON.stringify({ template: 'ws.nope' }))).status).toBe(400)
    expect(state.request).not.toHaveBeenCalled()
  })

  it('서버 계획으로만 호출 · 사용자 id 는 세션 · no-store', async () => {
    const r = await post(ok)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.json()).toEqual({ status: 'waiting_link' })
    expect(state.request).toHaveBeenCalledWith({ service: true }, { session: true }, 'u', { view: { view: true }, template: 'ws.central-meaning', workspaceId: 'w', planVersion: 2, goalVersion: 7 })
  })

  it('계획 없음 409 · 미설치 503 · DB 오류는 빈 성공이 아니라 502', async () => {
    state.saved = false
    expect((await post(ok)).status).toBe(409)
    state.saved = true
    state.request.mockResolvedValue({ status: 'not_installed' })
    expect((await post(ok)).status).toBe(503)
    state.request.mockRejectedValue(new Error('수요 줄 조회 실패'))
    const r = await post(ok)
    expect(r.status).toBe(502)
    expect(await r.json()).toMatchObject({ code: 'request_failed' })
  })
})

describe('readFactoryRequest — 카드의 엄격 응답 파서', () => {
  const D = '11111111-1111-4111-8111-111111111111'
  it('정상 상태만 통과 · 잘못된 200 은 실패', () => {
    expect(readFactoryRequest(true, { status: 'delivered', first: D, delivered: 3, replayed: false })).toEqual({ status: 'delivered', first: D })
    expect(readFactoryRequest(true, { status: 'waiting_link' })).toEqual({ status: 'waiting_link' })
    expect(readFactoryRequest(true, { status: 'delivered', first: 'x', delivered: 3, replayed: false })).toEqual({ status: 'failed' })
    expect(readFactoryRequest(true, { status: 'delivered', first: D, delivered: 0, replayed: false })).toEqual({ status: 'failed' })
    expect(readFactoryRequest(true, { status: 'waiting_link', extra: 1 })).toEqual({ status: 'failed' })
    expect(readFactoryRequest(true, { status: 'done' })).toEqual({ status: 'failed' })
    expect(readFactoryRequest(true, null)).toEqual({ status: 'failed' })
    expect(readFactoryRequest(false, { code: 'plan_required' })).toEqual({ status: 'plan_required' })
    expect(readFactoryRequest(false, { code: 'not_installed' })).toEqual({ status: 'not_installed' })
    expect(readFactoryRequest(false, { code: 'request_failed' })).toEqual({ status: 'failed' })
  })
})
