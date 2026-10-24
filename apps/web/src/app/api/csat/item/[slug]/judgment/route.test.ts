// apps/web/src/app/api/csat/item/[slug]/judgment/route.test.ts
//
// 판단 라우트 — 노출 원장 기록이 성공해야만 정답 자료를 돌려준다(fail-closed). 인증 · 보류 · 판본 결속 · no-store.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const st = vi.hoisted(() => ({
  user: 'u1' as string | null,
  open: true,
  version: 4 as number | null,
  rpc: { data: 77 as unknown, error: null as null | { code: string } },
  calls: [] as string[],
}))

vi.mock('@/lib/csat/diagnosis/route-helpers', async () => {
  const { NextResponse } = await import('next/server')
  return {
    readJson: async (req: Request) => req.json().catch(() => null),
    learnerContext: async () => {
      if (!st.user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
      return {
        userId: st.user,
        email: 'learner@example.com',
        db: {
          rpc: async (name: string, args: Record<string, unknown>) => {
            st.calls.push(`rpc:${name}:${args.p_kind}:${args.p_source}:${args.p_item_ref}:${args.p_analysis_version}`)
            return st.rpc
          },
        },
      }
    },
  }
})
vi.mock('@/lib/csat/embargo-gate', () => ({
  canRevealItem: async () => st.open,
  revealHeldResponse: () => new Response(JSON.stringify({ held: 'exam_embargo' }), { status: 423, headers: { 'cache-control': 'no-store' } }),
}))
vi.mock('@/lib/csat/learner', () => ({
  loadCsatItemExplain: async (id: string) => ({ item: { id, analysis_version: st.version }, error: null, held: false }),
}))
vi.mock('@/lib/csat/judgment-reveal', () => ({
  loadTheaterAnswer: async () => {
    st.calls.push('load-reveal')
    return { reveal: { analysisVersion: st.version, gate: { answer: 5, evidence: [6], selection: null, transform_note: null }, blocks: [{ key: 'analysis:answer', kind: 'answer', title: '답이 왜 이것인가', chips: [], body: ['정답 근거'], quote: null }] } }
  },
}))

import { POST } from './route'

const body = (o: Record<string, unknown> = {}) => ({ analysisVersion: 4, clientExposureId: '0b0c8f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f', source: 'judgment_scene', ...o })
const call = (o?: Record<string, unknown>, slug = '2014A-23') =>
  POST(new Request('http://x/api/csat/item/x/judgment', { method: 'POST', body: JSON.stringify(body(o)) }), { params: Promise.resolve({ slug }) })

describe('판단 라우트 — 기록 뒤에만 정답', () => {
  beforeEach(() => {
    st.user = 'u1'
    st.open = true
    st.version = 4
    st.rpc = { data: 77, error: null }
    st.calls = []
  })

  it('성공 — answer_direct · judgment_scene 기록이 공개 자료보다 먼저, no-store', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const j = await res.json()
    expect(j).toMatchObject({ ok: true, exposureId: 77, reveal: { gate: { answer: 5 } } })
    expect(st.calls).toEqual(['rpc:learning_exposure_record:answer_direct:judgment_scene:2014A#23:4', 'load-reveal'])
  })

  it('기록 실패 → 503 · 정답 자료 없음 · 공개 자료를 만들지도 않는다', async () => {
    st.rpc = { data: null, error: { code: '42501' } }
    const res = await call()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).not.toMatch(/reveal|answer|정답 근거/)
    expect(st.calls).not.toContain('load-reveal')
  })

  it('기록 id 가 없으면(커밋 확인 실패) 503', async () => {
    st.rpc = { data: null, error: null }
    expect((await call()).status).toBe(503)
    expect(st.calls).not.toContain('load-reveal')
  })

  it('비로그인 401 · 기록 없음', async () => {
    st.user = null
    expect((await call()).status).toBe(401)
    expect(st.calls).toEqual([])
  })

  it('보류 문항 423 · 기록 없음', async () => {
    st.open = false
    expect((await call()).status).toBe(423)
    expect(st.calls).toEqual([])
  })

  it('분석 판본이 바뀌었으면 409 · 기록 없음', async () => {
    expect((await call({ analysisVersion: 3 })).status).toBe(409)
    expect(st.calls).toEqual([])
  })

  it('형식 오류 400 · 문항 모양 아님 404', async () => {
    expect((await call({ clientExposureId: 'nope' })).status).toBe(400)
    expect((await call({ source: 'item_page_render' })).status).toBe(400)
    expect((await call({}, '../etc')).status).toBe(404)
    expect(st.calls).toEqual([])
  })

  it('강의 전체 · 경계 계속도 같은 원장(source 만 다름)', async () => {
    await call({ source: 'lecture_continue' })
    expect(st.calls[0]).toBe('rpc:learning_exposure_record:answer_direct:lecture_continue:2014A#23:4')
  })
})
