// apps/web/src/app/api/csat/state/__tests__/route.test.ts
//
// 이슈 #182 — Reveal Gate ②(20261005170100 · 20261006110000)가 csat_learner_state 의 학습자 직접 권한을 회수했다.
// 그래서 이 경로는 로그인 확인만 쿠키로 하고 읽기 · 쓰기는 서버(service role)로, 언제나 **로그인한 본인 행만** 만진다.
// 지키는 계약: ① 로그인 없으면 401 ② 본인 user_id 로만 조회 · 저장 ③ 보류 판정 실패면 기록을 내보내지 않고 423
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  eqs: [] as [string, unknown][],
  upserts: [] as unknown[],
  gate: 'clear' as 'clear' | 'error',
  stored: { version: 1, seed: 1, onboarded: true, predictions: [{ item: '2026#31', type: 'T', step: 1, hit: true, at: 1 }], formulas: [], queue: [], completed: [] } as unknown,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { h.eqs.push([k, v]); return q },
        maybeSingle: async () => ({ data: { record: h.stored }, error: null }),
        upsert: async (row: unknown) => { h.upserts.push(row); return { error: null } },
        delete: () => q,
      }
      return q
    },
    rpc: async () => (h.gate === 'error' ? { data: null, error: { message: 'reset' } } : { data: [], error: null }),
  }),
}))

import { GET, PUT } from '../route'

beforeEach(() => { h.user = { id: 'u1' }; h.eqs = []; h.upserts = []; h.gate = 'clear'; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('/api/csat/state — 서버 경로(#182)', () => {
  it('로그인 없으면 401', async () => {
    h.user = null
    expect((await GET()).status).toBe(401)
  })
  it('본인 행만 읽어 200 으로 돌려준다', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(h.eqs).toContainEqual(['user_id', 'u1'])
    expect((await res.json()).ok).toBe(true)
  })
  it('보류 판정 실패면 기록을 내보내지 않고 423', async () => {
    h.gate = 'error'
    const res = await GET()
    expect(res.status).toBe(423)
    expect(await res.text()).not.toContain('2026#31')
  })
  it('저장도 본인 행으로', async () => {
    const res = await PUT(new Request('http://x/api/csat/state', { method: 'PUT', body: JSON.stringify({ record: h.stored }) }))
    expect(res.status).toBeLessThan(300)
    expect(h.eqs.every(([k, v]) => k !== 'user_id' || v === 'u1')).toBe(true)
    expect(h.upserts).toHaveLength(1)
    expect((h.upserts[0] as { user_id: string }).user_id).toBe('u1')
  })
})

describe('/api/csat/state PUT — 보류로 빠진 진행 세트를 지키기(Codex P1)', () => {
  it('들어온 기록에 active 가 없고 서버 세트가 보류(판정 실패 포함)면 서버 세트를 남긴다', async () => {
    const active = { items: ['2026#31', '2026#32'], index: 0, startedAt: 1, loci: {} }
    h.stored = { ...(h.stored as object), active, updatedAt: 1 }
    h.gate = 'error'
    const incoming = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], updatedAt: 5 }
    await PUT(new Request('http://x/api/csat/state', { method: 'PUT', body: JSON.stringify({ record: incoming }) }))
    expect((h.upserts[0] as { record: { active?: unknown } }).record.active).toEqual(active)
  })
})

describe('/api/csat/state PUT — 새 세트가 와도 보류 세트를 덮지 않는다(Codex P1 재리뷰)', () => {
  it('서버 세트가 보류면 들어온 새 세트 대신 서버 세트를 남긴다', async () => {
    const held = { items: ['2026#31'], index: 1, startedAt: 1, loci: { '2026#31': [2] } }
    h.stored = { ...(h.stored as object), active: held, updatedAt: 1 }
    h.gate = 'error'
    const incoming = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], updatedAt: 9, active: { items: ['2025#40'], index: 0, startedAt: 9, loci: {} } }
    await PUT(new Request('http://x/api/csat/state', { method: 'PUT', body: JSON.stringify({ record: incoming }) }))
    expect((h.upserts[0] as { record: { active?: unknown } }).record.active).toEqual(held)
  })
})

describe('/api/csat/state — 보류 중 진행 세트 P2', () => {
  it('같은 세트의 더 나아간 진행은 받는다', async () => {
    const held = { items: ['2026#31', '2026#32'], index: 0, startedAt: 1, loci: {} }
    h.stored = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], active: held, updatedAt: 1 }
    h.gate = 'error'
    const moved = { ...held, index: 1, loci: { '2026#31': [3] } }
    const incoming = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], updatedAt: 9, active: moved }
    await PUT(new Request('http://x/api/csat/state', { method: 'PUT', body: JSON.stringify({ record: incoming }) }))
    expect((h.upserts[0] as { record: { active?: unknown } }).record.active).toEqual(moved)
  })
})

describe('/api/csat/state — 같은 자리 근거 손실 방지(Codex P2)', () => {
  it('같은 세트 · 같은 index 라도 서버의 근거(loci)를 잃은 사본은 받지 않는다', async () => {
    const held = { items: ['2026#31'], index: 0, startedAt: 1, pairSeen: true, loci: { '2026#31': '3' } }
    h.stored = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], active: held, updatedAt: 1 }
    h.gate = 'error'
    const stale = { ...held, pairSeen: false, loci: {} }
    const incoming = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], updatedAt: 9, active: stale }
    await PUT(new Request('http://x/api/csat/state', { method: 'PUT', body: JSON.stringify({ record: incoming }) }))
    expect((h.upserts[0] as { record: { active?: unknown } }).record.active).toEqual(held)
  })
})
