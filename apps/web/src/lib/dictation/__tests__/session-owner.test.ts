// apps/web/src/lib/dictation/__tests__/session-owner.test.ts
//
// 받아쓰기 세션 주인 결속 — 다른 탭에서 계정이 바뀐 뒤 옛 화면의 시작 · 제출 · 완주가 지금 계정으로 남지 않는다.
//   start: 자료를 읽은 사람(expectedOwner) ≠ 시작 시점 사용자 → 시작하지 않음(identityChanged)
//   attempt · complete: 세션 주인 ≠ 지금 사용자 → 세션 통계 · 점수 · FSRS 를 남기지 않음
//   restore: 주인 = 실제로 읽힌 행의 user_id(응답 뒤 재조회한 신원이 아님)
// 저장소는 대역이다 — 실제 DB · RLS 는 증명하지 않는다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ scores: [] as unknown[], flush: [] as unknown[], writes: [] as string[] }))

vi.mock('@/lib/scores/record-score', () => ({ recordGameScore: async (i: unknown) => void h.scores.push(i) }))
vi.mock('@/lib/srs/flush-actions', () => ({
  flushPendingSrsResults: async (items: unknown[]) => {
    h.flush.push(items)
    return { ok: true, persisted: items.length, skipped: 0, duplicated: 0, acked: [] }
  },
}))

import { completeDictationSession, restoreDictationSession, saveDictationAttempt, startDictationSession } from '../persist'

function client(userId: string | null, row?: Record<string, unknown>) {
  const q = (table: string) => {
    const b = {
      insert: () => (h.writes.push(`insert:${table}`), { select: () => ({ single: async () => ({ data: { id: 'sess-1' }, error: null }) }) }),
      upsert: async () => (h.writes.push(`upsert:${table}`), { error: null }),
      update: () => (h.writes.push(`update:${table}`), { eq: async () => ({ error: null }) }),
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: async () => ({ data: [] }),
      maybeSingle: async () => ({ data: row ?? null }),
    }
    return b
  }
  return { auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) }, from: q } as never
}

const complete = {
  sessionId: 'sess-1',
  source: { kind: 'text', title: 't', textId: null } as never,
  completedItems: 1,
  totalItems: 1,
  avgAccuracy: 100,
  totalHints: 0,
  durationMs: 1000,
  longestPerfectWords: 3,
  targetRatings: new Map<string, 1 | 2 | 3 | 4>([['harbor', 3]]),
}
const attempt = { sessionId: 'sess-1', itemIdx: 0, expected: 'x', userInput: 'x', accuracy: 100, hintsUsed: 0, replayCount: 0, durationMs: 1, skipped: false, wordResults: [], errorTags: [], targetWords: [], targetHits: [] }

beforeEach(() => {
  h.scores = []
  h.flush = []
  h.writes = []
})

describe('받아쓰기 세션 주인', () => {
  it('시작: 자료를 읽은 A 와 시작 시점 B 가 다르면 세션을 만들지 않는다', async () => {
    const r = await startDictationSession(client('user-b'), { kind: 'text', title: 't' } as never, {} as never, 1, [], 'user-a')
    expect(r.identityChanged).toBe(true)
    expect(h.writes).toEqual([])
    const ok = await startDictationSession(client('user-a'), { kind: 'text', title: 't' } as never, {} as never, 1, [], 'user-a')
    expect(ok).toEqual(expect.objectContaining({ persisted: true, owner: 'user-a' }))
  })

  it('제출: 세션 주인 A 인데 지금 B 면 시도를 남기지 않는다 · 같은 사람이면 남긴다', async () => {
    await saveDictationAttempt(client('user-b'), { ...attempt, expectedOwner: 'user-a' })
    expect(h.writes).toEqual([])
    await saveDictationAttempt(client('user-a'), { ...attempt, expectedOwner: 'user-a' })
    expect(h.writes).toEqual(['upsert:dictation_attempts'])
  })

  it('완주: 세션 주인 A 인데 지금 B 면 통계 · 점수 · FSRS 모두 없음', async () => {
    const res = await completeDictationSession(client('user-b'), { ...complete, expectedOwner: 'user-a' })
    expect([h.writes, h.scores, h.flush]).toEqual([[], [], []])
    expect(res.wordsPersisted).toBe(0)
  })

  it('완주: 같은 사람이면 통계 · 점수(expectedUserId=A) · FSRS(owner=A)', async () => {
    await completeDictationSession(client('user-a'), { ...complete, expectedOwner: 'user-a' })
    expect(h.writes).toEqual(['update:dictation_sessions'])
    expect(h.scores).toEqual([expect.objectContaining({ expectedUserId: 'user-a' })])
    expect(h.flush).toEqual([[expect.objectContaining({ word: 'harbor', owner: 'user-a' })]])
  })

  it('복원: 주인은 읽힌 행의 user_id(지금 브라우저 신원과 무관)', async () => {
    const row = { id: 'sess-1', user_id: 'user-a', title: 't', source_kind: 'text', config: {}, items: [{ index: 0 }], completed_at: null, total_hints: 0 }
    const { session } = await restoreDictationSession(client('user-b'), 'sess-1')
    expect(session).toBeNull()
    const r = await restoreDictationSession(client('user-b', row), 'sess-1')
    expect(r.session?.owner).toBe('user-a')
  })
})
