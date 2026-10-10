// apps/web/src/lib/csat/__tests__/embargo-gate-failure.test.ts
//
// 관문 실패 방식 — 판정 RPC 오류 · 시간 초과면 학습자에게 423 held + no-store(500 · 데이터 아님).
// 운영 로그는 실제 보류(embargo)와 관문 실패(gate_failure)를 다른 줄로 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gate = vi.hoisted(() => ({ mode: 'error' as 'error' | 'hang' | 'held' | 'clear' }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    // /api/csat/state 의 서버 읽기 — 정오가 실린 기록 한 벌
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { record: { version: 1, seed: 1, onboarded: true, predictions: [{ item: 'M2509#18', type: 'T', step: 1, hit: true, at: 1 }], formulas: [], queue: [], completed: [] } }, error: null }) }
      return q
    },
    rpc: (_fn: string, args: Record<string, string[]>) => {
      if (gate.mode === 'hang') return new Promise(() => {})
      if (gate.mode === 'error') return Promise.resolve({ data: null, error: { message: 'connection reset' } })
      const ids = args.p_items ?? args.p_exams ?? []
      return Promise.resolve({ data: gate.mode === 'held' ? ids : [], error: null })
    },
  }),
}))
// 데이터 로더 — 관문을 지나면 불린다. 실패 · 보류에서 불리면 안 된다
const loader = vi.hoisted(() => ({ lecture: vi.fn(() => ({ cues: [{ text: 'SECRET-LECTURE' }] })) }))
vi.mock('@/lib/csat/lecture/store', () => ({ loadLecture: loader.lecture }))

import { GET as lectureGET } from '@/app/api/csat/lecture/route'
import { GET as stateGET } from '@/app/api/csat/state/route'
import { GATE_TIMEOUT_MS } from '../embargo-gate'

const req = () => new Request('http://x/api/csat/lecture?item=M2509-18')

describe('관문 실패 = 423 held · no-store', () => {
  let err: { mock: { calls: unknown[][] } }
  let info: { mock: { calls: unknown[][] } }
  beforeEach(() => {
    loader.lecture.mockClear()
    err = vi.spyOn(console, 'error').mockImplementation(() => {})
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  const expectHeld = async (res: Response) => {
    expect(res.status).toBe(423)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ held: 'exam_embargo' })
    expect(text).not.toContain('SECRET')
    expect(loader.lecture).not.toHaveBeenCalled()
  }

  it('RPC 오류 → 423 · 로그는 gate_failure', async () => {
    gate.mode = 'error'
    await expectHeld(await lectureGET(req()))
    expect(err.mock.calls.some((c) => String(c[0]).includes('gate_failure'))).toBe(true)
    expect(info.mock.calls.some((c) => String(c[0]).includes('embargo'))).toBe(false)
  })

  it('RPC 시간 초과 → 423 · 로그는 gate_failure(timeout)', async () => {
    gate.mode = 'hang'
    vi.useFakeTimers()
    const p = lectureGET(req())
    await vi.advanceTimersByTimeAsync(GATE_TIMEOUT_MS + 10)
    await expectHeld(await p)
    expect(err.mock.calls.some((c) => String(c[0]).includes('gate_failure') && (c[1] as { timeout?: boolean })?.timeout === true)).toBe(true)
  })

  it('실제 보류 → 423 · 로그는 embargo(gate_failure 아님)', async () => {
    gate.mode = 'held'
    await expectHeld(await lectureGET(req()))
    expect(info.mock.calls.some((c) => String(c[0]).includes('embargo'))).toBe(true)
    expect(err.mock.calls.some((c) => String(c[0]).includes('gate_failure'))).toBe(false)
  })

  it('보류 아님 → 데이터(대조군)', async () => {
    gate.mode = 'clear'
    const res = await lectureGET(req())
    expect(res.status).toBe(200)
    expect(loader.lecture).toHaveBeenCalled()
  })

  it('/api/csat/state — 판정 실패면 기록(정오) 대신 423', async () => {
    gate.mode = 'error'
    const res = await stateGET()
    expect(res.status).toBe(423)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('M2509#18')
  })

  it('/api/csat/state — 보류 문항의 예측(정오)을 뺀다', async () => {
    gate.mode = 'held'
    const res = await stateGET()
    expect(res.status).toBe(200)
    expect((await res.json()).record.predictions).toEqual([])
  })
})
