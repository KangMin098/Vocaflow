// apps/web/src/lib/learner/__tests__/textbook-practice-scope-loader.test.ts
// fetchTextbookPracticeItems 가 조회 경로(scope)를 넘긴다 — 로그인 필요 · 조회 실패 · 빈 결과와 섞지 않고,
// 실패에서는 경로를 붙이지 않으며(null), 옛 V레벨 함수는 「함수 없음」일 때만 쓴다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Res = { data: unknown; error: { code?: string; message?: string } | null }
const h = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  volume: { data: [], error: null } as Res,
  legacy: { data: [], error: null } as Res,
  respond: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    rpc: (name: string, args: unknown) => {
      h.respond(name, args)
      return Promise.resolve(name === 'textbook_practice_items_for' ? h.volume : h.legacy)
    },
  }),
}))

import { fetchTextbookPracticeItems, gradeTextbookPracticeItem } from '../dcp-actions'

const VOL = { series: 'vocab', step: 5, vLevel: 5 }
const ROW = {
  id: 'o1',
  type: 'order',
  paragraph_idx: 0,
  ref_title: 'A Walk',
  payload: {
    presented: [
      'Every morning the old man walked slowly along the quiet river near his small house in the valley.',
      'He watched the birds, listened to the water and greeted the neighbours who passed him on the narrow path.',
      'These walks gave him time to think about his family, his garden and the long years he had spent there.',
      'When winter came and the path froze, he missed the river more than he could explain to anyone.',
    ],
  },
}

beforeEach(() => {
  h.user = { id: 'u1' }
  h.volume = { data: [], error: null }
  h.legacy = { data: [], error: null }
  h.respond.mockClear()
})

describe('fetchTextbookPracticeItems scope', () => {
  it('로그인 필요 — scope null, RPC 호출 없음', async () => {
    h.user = null
    const r = await fetchTextbookPracticeItems(VOL, 8)
    expect(r).toMatchObject({ signedOut: true, unavailable: true, scope: null, items: [] })
    expect(h.respond).not.toHaveBeenCalled()
  })
  it('권 함수 성공 · 빈 결과 — scope volume, 옛 함수로 메우지 않는다', async () => {
    const r = await fetchTextbookPracticeItems(VOL, 8)
    expect(r).toMatchObject({ signedOut: false, unavailable: false, scope: 'volume', items: [] })
    expect(h.respond).toHaveBeenCalledTimes(1)
  })
  it('함수 없음 → 옛 V레벨 공통 풀 — scope legacy_v_level', async () => {
    h.volume = { data: null, error: { code: 'PGRST202' } }
    h.legacy = { data: [ROW], error: null }
    const r = await fetchTextbookPracticeItems(VOL, 8)
    expect(r.scope).toBe('legacy_v_level')
    expect(r.unavailable).toBe(false)
    expect(h.respond).toHaveBeenCalledWith('textbook_practice_items', { p_v_level: 5, p_limit: expect.any(Number) })
  })
  it('권한 · 네트워크 오류 — 조회 실패, scope null, 옛 함수로 우회 없음', async () => {
    for (const code of ['42501', undefined]) {
      h.respond.mockClear()
      h.volume = { data: null, error: { code, message: 'x' } }
      const r = await fetchTextbookPracticeItems(VOL, 8)
      expect(r).toMatchObject({ signedOut: false, unavailable: true, scope: null, items: [] })
      expect(h.respond).toHaveBeenCalledTimes(1)
    }
  })
  it('옛 함수 자체가 실패 — 조회 실패, scope null', async () => {
    h.volume = { data: null, error: { code: '42883' } }
    h.legacy = { data: null, error: { code: '42501', message: 'x' } }
    const r = await fetchTextbookPracticeItems(VOL, 8)
    expect(r).toMatchObject({ unavailable: true, scope: null })
  })
})

describe('fetchTextbookPracticeItems ownerId', () => {
  it('성공한 조회에만 서버 getUser 계정을 싣는다 — 로그인 필요 · 실패는 null', async () => {
    expect((await fetchTextbookPracticeItems(VOL, 8)).ownerId).toBe('u1')
    h.volume = { data: null, error: { code: '42501', message: 'x' } }
    expect((await fetchTextbookPracticeItems(VOL, 8)).ownerId).toBeNull()
    h.user = null
    expect((await fetchTextbookPracticeItems(VOL, 8)).ownerId).toBeNull()
  })
})

describe('gradeTextbookPracticeItem — 요청 계정 ≠ 예상 주인이면 RPC 전에 거부', () => {
  it('다른 계정 · 로그아웃: grade_dcp_item 호출 0, 실패(오답 아님)', async () => {
    for (const user of [{ id: 'u2' }, null]) {
      h.respond.mockClear()
      h.user = user
      const r = await gradeTextbookPracticeItem('u1', 'o1', { order: [0, 1, 2, 3] })
      expect(r.ok).toBe(false)
      expect(h.respond).not.toHaveBeenCalled()
    }
  })
  it('같은 계정: 기존 grade_dcp_item 에 문항 · 답만 넘기고 결과 형식은 그대로', async () => {
    h.legacy = { data: { correct: true, attempt_id: 'att', answer_key: null }, error: null }
    const r = await gradeTextbookPracticeItem('u1', 'o1', { order: [0, 1, 2, 3] })
    expect(h.respond).toHaveBeenCalledWith('grade_dcp_item', { p_item_id: 'o1', p_answer: { order: [0, 1, 2, 3] } })
    expect(r).toEqual({ ok: true, correct: true, attemptId: 'att', answerKey: null })
  })
})
