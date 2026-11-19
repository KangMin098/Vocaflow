// apps/web/src/app/api/csat/factory/__tests__/factory-routes.test.ts
// 1D API — 실제 route handler(GET 목록 · POST 제출)를 부른다. 대역(명시): 로그인 판정 learnerContext · supabase 서버 클라이언트의 rpc.
// 판정 SQL 자체는 dcp-learning.pglite.test.ts 가 실제 SQL 로 본다. 여기서는 로그인 · 출처 · 형식 · 바이트 상한 · RPC 없음/실패 매핑만.
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  loggedIn: true,
  rpc: vi.fn<[string, Record<string, unknown>], Promise<{ data: unknown; error: { message: string; code?: string } | null }>>(),
}))
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => (state.loggedIn ? { userId: 'u', email: null, db: {} } : NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: (fn: string, args: Record<string, unknown>) => state.rpc(fn, args) }) }))

import { GET } from '../route'
import { POST } from '../[deliveryId]/attempt/route'

const D = '11111111-1111-4111-8111-111111111111'
const M = '55555555-5555-4555-8555-555555555555'
const A = '22222222-2222-4222-8222-222222222222'
const R = '66666666-6666-4666-8666-666666666666'
const URL_ = `https://vocaflow.test/api/csat/factory/${D}/attempt`
const post = (body: string, headers: Record<string, string> = {}) =>
  POST(new Request(URL_, { method: 'POST', body, headers: { origin: 'https://vocaflow.test', 'content-type': 'application/json', ...headers } }), { params: { deliveryId: D } })
const okResult = { receipt_id: R, delivery_id: D, correct: true, csat_attempt_id: A, answer_key: null, evidence: false, non_evidence_reason: 'role_not_evidence', replayed: false }

beforeEach(() => {
  state.loggedIn = true
  state.rpc.mockReset()
  state.rpc.mockResolvedValue({ data: okResult, error: null })
})

describe('POST /api/csat/factory/[deliveryId]/attempt', () => {
  it('정상 — 200 · RPC 에는 choice 만', async () => {
    const r = await post(JSON.stringify({ choice: 2, mutationId: M }))
    expect(r.status).toBe(200)
    expect((await r.json()).result).toMatchObject({ receiptId: R, csatAttemptId: A, correct: true, replayed: false })
    expect(state.rpc).toHaveBeenCalledWith('factory_dcp_attempt', { p_delivery: D, p_answer: { choice: 2 }, p_mutation: M })
  })
  it('로그인 없음 → 401 · RPC 안 부름', async () => {
    state.loggedIn = false
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }))).status).toBe(401)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it.each([
    ['Origin 없음', { origin: '' }], ['다른 host', { origin: 'https://evil.test' }], ['같은 host 다른 스킴', { origin: 'http://vocaflow.test' }],
    ['같은 host 다른 포트', { origin: 'https://vocaflow.test:8443' }], ['null Origin', { origin: 'null' }], ['경로가 붙은 Origin', { origin: 'https://vocaflow.test/x' }],
  ])('%s → 403', async (_l, h) => {
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }), h)).status).toBe(403)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('JSON 아님 → 415', async () => expect((await post('{}', { 'content-type': 'text/plain' })).status).toBe(415))
  it('UTF-8 바이트 상한 — 문자 수는 512 이하지만 바이트가 넘으면 413', async () => {
    const body = JSON.stringify({ choice: 2, mutationId: M, pad: '가'.repeat(200) })
    expect(body.length).toBeLessThanOrEqual(512)
    expect((await post(body)).status).toBe(413)
  })
  it.each([['{', 400], [JSON.stringify({ choice: 2 }), 400], [JSON.stringify({ choice: 2, mutationId: M, correct: true }), 400]])('형식 %s → %i', async (b, s) => {
    expect((await post(b)).status).toBe(s)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('RPC 없음 → 503 · RPC 실패 → 502 · 모양 불일치 200 → 502 · 비유효 → 410 · 키 재사용 → 409', async () => {
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function', code: 'PGRST202' } })
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }))).status).toBe(503)
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }))).status).toBe(502)
    state.rpc.mockResolvedValueOnce({ data: { correct: true }, error: null })
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }))).status).toBe(502)
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'attempt: delivery not_current', code: 'P0001' } })
    const gone = await post(JSON.stringify({ choice: 2, mutationId: M }))
    expect([gone.status, (await gone.json()).code]).toEqual([410, 'not_current'])
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'attempt: mutation key reused with a different body', code: '23505' } })
    expect((await post(JSON.stringify({ choice: 2, mutationId: M }))).status).toBe(409)
  })
})

describe('GET /api/csat/factory', () => {
  const get = (q: string) => GET(new Request(`https://vocaflow.test/api/csat/factory${q}`))
  it('로그인 없음 → 401', async () => {
    state.loggedIn = false
    expect((await get('?template=ws.reading')).status).toBe(401)
  })
  it('템플릿 형식 → 400 · RPC 없음 → not_installed · 실패 → 502', async () => {
    expect((await get('?template=nope')).status).toBe(400)
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x', code: 'PGRST202' } })
    expect(await (await get('?template=ws.reading')).json()).toEqual({ status: 'not_installed' })
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    expect((await get('?template=ws.reading')).status).toBe(502)
  })
})
