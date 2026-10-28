// apps/web/src/lib/echo/__tests__/record-owner.test.ts
// @vitest-environment node
// 따라읽기 기록 어댑터의 주인 결속 — 시도를 한 사람(expectedUserId)과 지금 로그인 사용자가 다르면 쓰기 0.
// 같은 사람은 기존대로 1회 쓴다. DB 는 대역(supabase 브라우저 클라이언트)만.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  uid: 'owner-a' as string | null,
  inserts: [] as { table: string; row: unknown }[],
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.uid ? { id: h.uid } : null } }) },
    from: (table: string) => ({
      insert: (row: unknown) => {
        h.inserts.push({ table, row })
        const res = { data: { id: 'sess-1' }, error: null }
        return Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => res }),
        })
      },
    }),
  }),
}))
vi.mock('@/lib/workspace/scoped-words', () => ({ loadInflectedForms: async () => new Map() }))

import { saveEchoAttempt } from '../save-attempt'
import { recordEchoSound } from '../record-sound'
import type { SoundRecord } from '../word-signal'

const SCORE = { pitch: 80, energy: 70, timing: 75, overall: 76 }
const REC = [{ lemma: { id: 'v1', word: 'fox', forms: [] }, isCorrect: true, evidence: 'transcript' }] as unknown as SoundRecord[]

let n = 0
beforeEach(() => {
  h.inserts = []
  h.uid = 'owner-a'
  n += 1
})

describe('saveEchoAttempt 주인 결속', () => {
  it('같은 사람이면 세션 + 시도 1회 저장(기존 계약)', async () => {
    const r = await saveEchoAttempt({ textId: `t-${n}`, sentenceId: 's0', attemptNumber: 1, score: SCORE, expectedUserId: 'owner-a' })
    expect(r.ok).toBe(true)
    expect(h.inserts.map((i) => i.table)).toEqual(['echo_match_sessions', 'echo_match_attempts'])
    expect(h.inserts.every((i) => (i.row as { user_id: string }).user_id === 'owner-a')).toBe(true)
  })

  it('getUser 가 B 로 풀리고 예상이 A 면 쓰기 0', async () => {
    h.uid = 'owner-b'
    const r = await saveEchoAttempt({ textId: `t-${n}`, sentenceId: 's0', attemptNumber: 1, score: SCORE, expectedUserId: 'owner-a' })
    expect(r).toEqual({ ok: false, reason: 'owner-mismatch' })
    expect(h.inserts).toHaveLength(0)
  })

  it('예상 주인이 null(확인 못 함)이면 로그인 사용자가 있어도 쓰기 0', async () => {
    const r = await saveEchoAttempt({ textId: `t-${n}`, sentenceId: 's0', attemptNumber: 1, score: SCORE, expectedUserId: null })
    expect(r.ok).toBe(false)
    expect(h.inserts).toHaveLength(0)
  })
})

describe('recordEchoSound 주인 결속', () => {
  it('같은 사람이면 learning_records 1회 적재', async () => {
    const r = await recordEchoSound(REC, { sentenceId: 's0', overall: 76, expectedUserId: 'owner-a' })
    expect(r).toEqual({ ok: true, written: 1 })
    expect(h.inserts).toHaveLength(1)
    expect(h.inserts[0]!.table).toBe('learning_records')
  })

  it('getUser 가 B 로 풀리고 예상이 A 면 쓰기 0', async () => {
    h.uid = 'owner-b'
    const r = await recordEchoSound(REC, { sentenceId: 's0', overall: 76, expectedUserId: 'owner-a' })
    expect(r).toEqual({ ok: false, written: 0, reason: 'owner-mismatch' })
    expect(h.inserts).toHaveLength(0)
  })
})
