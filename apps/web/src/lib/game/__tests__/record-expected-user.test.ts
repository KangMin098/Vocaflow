// apps/web/src/lib/game/__tests__/record-expected-user.test.ts
//
// 판 시작자 결속 — 저장 함수는 저장 **시점**의 사용자로 쓴다. 판을 시작한 사람(expectedUserId)과 다르면
// scores INSERT · vocabularies 조회/갱신을 하지 않는다(옛 판의 언마운트 flush · 늦은 입력이 B 계정에 들어가지 않게).
// expectedUserId 를 주지 않으면 기존 동작 그대로.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ from: [] as string[], uid: 'user-b' as string | null }))

function fakeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: calls.uid ? { id: calls.uid } : null } }) },
    from: (table: string) => {
      calls.from.push(table)
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async () => ({ error: null }),
      }
      return q
    },
  }
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => fakeClient() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))
vi.mock('@/lib/game/arcade-meta', () => ({ awardArcadeXp: () => {} }))

import { recordGameScore } from '@/lib/scores/record-score'
import { recordGameResult } from '@/lib/game/record-result'

beforeEach(() => {
  calls.from = []
  calls.uid = 'user-b'
})

describe('recordGameScore · expectedUserId', () => {
  it('판 시작자(A)와 지금 사용자(B)가 다르면 scores 에 쓰지 않는다', async () => {
    await recordGameScore({ module: 'wordblitz', score: 300, expectedUserId: 'user-a' })
    expect(calls.from).toEqual([])
  })

  it('시작 때 로그인 없음(null) 판도 지금 B 로 쓰지 않는다', async () => {
    await recordGameScore({ module: 'wordblitz', score: 300, expectedUserId: null })
    expect(calls.from).toEqual([])
  })

  it('같은 사람이면 쓴다 · 주지 않으면 기존 동작', async () => {
    await recordGameScore({ module: 'wordblitz', score: 300, expectedUserId: 'user-b' })
    await recordGameScore({ module: 'wordblitz', score: 300 })
    expect(calls.from).toEqual(['scores', 'scores'])
  })
})

describe('recordGameResult · expectedUserId', () => {
  it('다르면 identity-changed 로 돌려주고 vocabularies 를 읽지도 쓰지도 않는다', async () => {
    const res = await recordGameResult({ word: 'harvest', isCorrect: true, module: 'wordblitz', expectedUserId: 'user-a' })
    expect(res).toEqual({ ok: false, error: 'identity-changed' })
    expect(calls.from).toEqual([])
  })

  it('같은 사람이면 기존 경로(vocabularies 조회)로 간다', async () => {
    const res = await recordGameResult({ word: 'harvest', isCorrect: true, module: 'wordblitz', expectedUserId: 'user-b' })
    expect(calls.from[0]).toBe('vocabularies')
    expect(res).toEqual({ ok: true, updated: false, reason: 'not-mine' })
  })
})
