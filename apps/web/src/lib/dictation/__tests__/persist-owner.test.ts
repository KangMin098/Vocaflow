// apps/web/src/lib/dictation/__tests__/persist-owner.test.ts
//
// T-0172 r1 P1-5 — SRS 서버 액션이 평가의 주인(owner)을 확인하게 되면서, 받아쓰기 완주가 owner 없이 보내던
// 타깃 단어 평가가 전부 「남의 것」으로 걸러져 FSRS · learning_records 반영이 멈췄다(회귀).
// 완주 시점에 검증된 로그인 계정(`auth.getUser`)을 주인으로 붙여 보내야 한다. 로그인이 없으면 보내지 않는다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ calls: [] as { word: string; owner?: string }[][] }))

vi.mock('@/lib/scores/record-score', () => ({ recordGameScore: async () => {} }))
vi.mock('@/lib/srs/flush-actions', () => ({
  flushPendingSrsResults: async (items: { word: string; owner?: string }[]) => {
    h.calls.push(items)
    return { ok: true, persisted: items.length, skipped: 0, duplicated: 0, acked: [] }
  },
}))

import { completeDictationSession } from '../persist'

const client = (userId: string | null) => ({
  auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
  from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
}) as never

const input = {
  sessionId: 'local-1',
  source: { kind: 'text', title: 't', textId: null } as never,
  completedItems: 1,
  totalItems: 1,
  avgAccuracy: 100,
  totalHints: 0,
  durationMs: 1000,
  longestPerfectWords: 3,
  targetRatings: new Map<string, 1 | 2 | 3 | 4>([['harbor', 3]]),
}

beforeEach(() => { h.calls = [] })

describe('받아쓰기 완주 → FSRS 평가에 주인 결속(T-0172 r1 P1-5)', () => {
  it('검증된 로그인 계정을 owner 로 붙여 보낸다', async () => {
    const res = await completeDictationSession(client('user-D'), input)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].map((i) => [i.word, i.owner])).toEqual([['harbor', 'user-D']])
    expect(res.wordsPersisted).toBe(1)
  })
  it('로그인이 없으면 평가를 보내지 않는다', async () => {
    await completeDictationSession(client(null), input)
    expect(h.calls).toEqual([])
  })
})
