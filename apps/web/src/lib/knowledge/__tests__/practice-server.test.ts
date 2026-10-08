// apps/web/src/lib/knowledge/__tests__/practice-server.test.ts
// /csat/practice 제출 경로 — 테스트 더블만 쓴다(DB 에 닿지 않는다). 쓰기 어댑터(direct · g2)의 멱등 · 순서 계약.
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { annotationFor, annotationHash } from '../claim-support'
import { PRACTICE_TASK, SKELETON_TASK, keyFromAnnotation, type PracticeSubmission } from '../practice'
import { PracticeInputError, loadMyAttempts, submitPractice, type ServerEntry, type SubmitDeps } from '../practice-server'
import { directWriter, g2Writer, responseOf, selectWriter, stableUuid, type AttemptWrite, type AttemptWriter, type WriteOutcome } from '../practice-writer'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

const ann = annotationFor('2022#20')!
const ENTRY: ServerEntry = {
  itemId: '2022#20', no: 20, examLabel: '2022학년도 수능', typeId: 'R-CLAIM', phase: 'practice', kind: 'annotated', bars: [1, 2, 3, 4, 5, 6, 7],
  relationSentence: 3, key: keyFromAnnotation(ann), contentHash: annotationHash(ann), applicationId: 'app-1', appVersion: 1,
}
const SK: ServerEntry = {
  ...ENTRY, itemId: '2020#22', kind: 'skeleton', typeId: 'R-TOPIC', phase: 'transfer', relationSentence: null, applicationId: null, appVersion: null,
  key: { itemId: '2020#22', kind: 'skeleton', sentenceCount: 5, claim: 2, claimRestated: [], support: [], supportDisputed: [0, 3, 4], trap: [1], relationProbe: null },
}
const SUB: PracticeSubmission = {
  itemId: '2022#20', claim: 1, support: [3, 4], relation: 'reason', option: 5, confidence: 3, sec: 30,
  clientMutationId: '7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', clientSessionId: '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
  answeredAt: '2026-10-08T05:59:00.000Z', helpLevel: 'independent', explanationViewedAt: null, preview: false,
}

function fakeWriter(outcome: WriteOutcome = 'inserted') {
  const calls: string[] = []
  const writes: AttemptWrite[] = []
  const writer: AttemptWriter = {
    kind: 'direct',
    reveal: async () => {
      calls.push('reveal')
      return null
    },
    noteExplanationView: async () => {
      calls.push('explain')
      return false
    },
    record: async (w) => {
      calls.push('record')
      writes.push(w)
      return outcome
    },
  }
  return { writer, calls, writes }
}
const deps = (writer: AttemptWriter, pool: ServerEntry[] = [ENTRY, SK], previewPool: ServerEntry[] = pool): SubmitDeps => ({
  db: {} as SupabaseClient,
  writer,
  pool: async (o) => (o.preview ? previewPool : pool.filter((p) => p.kind === 'annotated')),
  answer: async () => 5,
})

describe('submitPractice — 채점 → 공개 → 기록 → 판정', () => {
  it('공개(reveal)가 기록보다 먼저 · 정본 과제 키 · 적용 id · activity=practice · 판단 시각을 그대로', async () => {
    const f = fakeWriter()
    const r = await submitPractice(deps(f.writer), { userId: 'u1', synthetic: false }, SUB)
    expect(f.calls).toEqual(['reveal', 'record'])
    expect(f.writes[0]).toMatchObject({
      taskKey: PRACTICE_TASK, applicationId: 'app-1', activity: 'practice', phase: 'practice', helpLevel: 'independent', synthetic: false,
      answeredAt: SUB.answeredAt, clientMutationId: SUB.clientMutationId, clientSessionId: SUB.clientSessionId, isCorrect: true,
    })
    expect(r.feedback).toMatchObject({ claimHit: true, optionCorrect: true, claimSentences: [1], supportSentences: [3, 4] })
  })
  it('기록이 실패하면 정답 키가 나가지 않는다', async () => {
    const writer: AttemptWriter = { kind: 'direct', reveal: async () => null, noteExplanationView: async () => false, record: async () => { throw new Error('db down') } }
    await expect(submitPractice(deps(writer), { userId: 'u1', synthetic: false }, SUB)).rejects.toThrow('db down')
  })
  it('같은 제출 id 의 다른 답은 409 · 재전송(duplicate)은 같은 판정', async () => {
    await expect(submitPractice(deps(fakeWriter('conflict').writer), { userId: 'u1', synthetic: false }, SUB)).rejects.toMatchObject({ status: 409 })
    const d = await submitPractice(deps(fakeWriter('duplicate').writer), { userId: 'u1', synthetic: false }, SUB)
    expect(d.outcome).toBe('duplicate')
    expect(d.feedback.claimHit).toBe(true)
  })
  it('해설 먼저 본 세션의 판단은 viewed_first 로 남는다(독립 시도로 승격되지 않는다)', async () => {
    const f = fakeWriter()
    const r = await submitPractice(deps(f.writer), { userId: 'u1', synthetic: false }, { ...SUB, helpLevel: 'viewed_first' })
    expect(f.writes[0].helpLevel).toBe('viewed_first')
    expect(r.feedback.helpLevel).toBe('viewed_first')
  })
  it('골격 문항은 학습자 풀에 없고(404), 미리보기에서는 골격 과제 키 · synthetic 으로 · 전이 단계', async () => {
    const sub = { ...SUB, itemId: '2020#22', claim: 2, support: [], relation: null }
    await expect(submitPractice(deps(fakeWriter().writer), { userId: 'u1', synthetic: false }, sub)).rejects.toBeInstanceOf(PracticeInputError)
    const f = fakeWriter()
    await submitPractice(deps(f.writer), { userId: 'admin', synthetic: false }, { ...sub, preview: true })
    expect(f.writes[0]).toMatchObject({ taskKey: SKELETON_TASK, synthetic: true, phase: 'transfer', applicationId: null })
  })
  it('합성 계정은 실학습 경로에서도 synthetic', async () => {
    const f = fakeWriter()
    await submitPractice(deps(f.writer), { userId: 'bot', synthetic: true }, SUB)
    expect(f.writes[0].synthetic).toBe(true)
  })
  it('범위 밖 번호 · 관계 누락은 기록 전에 거부', async () => {
    const f = fakeWriter()
    await expect(submitPractice(deps(f.writer), { userId: 'u1', synthetic: false }, { ...SUB, relation: null })).rejects.toBeInstanceOf(PracticeInputError)
    expect(f.calls).toEqual([])
  })
})

/** PostgREST 흉내 — 이 어댑터가 쓰는 연쇄만 */
function fakeDb(rows: Record<string, unknown>[]) {
  const inserted: Record<string, unknown>[] = []
  const rpcs: { fn: string; args: Record<string, unknown> }[] = []
  const db = {
    from: () => {
      const filters: [string, unknown][] = []
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push([c, v]), q),
        limit: async () => ({
          data: rows.filter((r) => filters.every(([c, v]) => (c === 'response->>client_mutation_id' ? (r.response as Record<string, unknown>).client_mutation_id === v : r[c] === v))),
          error: null,
        }),
        insert: async (row: Record<string, unknown>) => (inserted.push(row), rows.push(row), { error: null }),
      }
      return q
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args })
      return fn === 'learning_session_apply' ? { data: [{ session_id: 'sess-1', outcome: 'inserted' }], error: null } : { data: [{ attempt_id: 1, outcome: 'inserted' }], error: null }
    },
  }
  return { db: db as unknown as SupabaseClient, inserted, rpcs }
}

const W: AttemptWrite = {
  userId: 'u1', taskKey: PRACTICE_TASK, applicationId: 'app-1', itemRef: '2022#20', contentHash: 'h', activity: 'practice', phase: 'practice',
  helpLevel: 'independent', synthetic: false, clientMutationId: SUB.clientMutationId, clientSessionId: SUB.clientSessionId,
  answeredAt: SUB.answeredAt, sec: 30, isCorrect: true, answer: { claim: 1, support: [3, 4], relation: 'reason', option: 5, confidence: 3 }, extra: { preview: false },
}

describe('direct 어댑터(지금) — 정본 13열에 INSERT · response 안에 G2 열 값', () => {
  it('처음은 inserted · 같은 id 같은 답은 duplicate(행 1개) · 같은 id 다른 답은 conflict', async () => {
    const f = fakeDb([])
    const w = directWriter(f.db)
    expect(await w.reveal(W)).toBeNull()
    expect(await w.record(W, null)).toBe('inserted')
    expect(await w.record(W, null)).toBe('duplicate')
    expect(await w.record({ ...W, answer: { ...W.answer, claim: 6 } }, null)).toBe('conflict')
    expect(await w.record({ ...W, answeredAt: '2026-10-08T05:59:01.000Z' }, null)).toBe('conflict')
    expect(f.inserted).toHaveLength(1)
    expect(Object.keys(f.inserted[0]).sort()).toEqual(['answered_at', 'application_id', 'content_hash', 'is_correct', 'item_ref', 'phase', 'response', 'sec', 'synthetic', 'task_key', 'user_id'])
    expect(f.inserted[0].response).toMatchObject({ activity: 'practice', help_level: 'independent', client_mutation_id: W.clientMutationId, client_session_id: W.clientSessionId })
  })
  it('다른 학습자의 같은 id 는 다른 키다', async () => {
    const f = fakeDb([])
    const w = directWriter(f.db)
    await w.record(W, null)
    expect(await w.record({ ...W, userId: 'u2' }, null)).toBe('inserted')
  })
})

describe('g2 어댑터(G2 적용 뒤) — 세션 공개 RPC → 시도 RPC', () => {
  it('공개를 먼저 적용하고 그 세션 id 로 시도를 기록 · 판단 시각을 넘긴다', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db)
    const sid = await w.reveal(W)
    expect(await w.record(W, sid)).toBe('inserted')
    expect(f.rpcs.map((r) => r.fn)).toEqual(['learning_session_apply', 'learning_attempt_record'])
    expect(f.rpcs[0].args).toMatchObject({ p_client_session_id: W.clientSessionId, p_stage: 'revealed', p_help_level: 'independent', p_activity: 'practice' })
    expect(f.rpcs[1].args).toMatchObject({ p_mutation: W.clientMutationId, p_session_id: 'sess-1', p_answered_at: W.answeredAt })
    expect(f.inserted).toHaveLength(0)
  })
  it('P1: 시도는 도움 수준을 보내지 않는다(NULL → 세션 상속) — viewed_first 를 실어도 세션과 모순되지 않는다', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db)
    await w.record({ ...W, helpLevel: 'viewed_first' }, 'sess-1')
    expect(f.rpcs[0].args.p_help_level).toBeNull()
  })
  it('P1: g2 response 에도 activity · help_level · client ids 사본 — direct 와 같은 모양', async () => {
    const f = fakeDb([])
    await g2Writer(f.db).record(W, 'sess-1')
    const d = fakeDb([])
    await directWriter(d.db).record(W, null)
    expect(f.rpcs[0].args.p_response).toEqual(responseOf(W))
    expect(d.inserted[0].response).toEqual(responseOf(W))
  })
  it('공개 변경 id 는 세션마다 결정론적 uuid', () => {
    expect(stableUuid('s', 'reveal')).toBe(stableUuid('s', 'reveal'))
    expect(stableUuid('s', 'reveal')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('기본은 direct — G2 SQL 적용 전에는 g2 를 켜지 않는다', () => {
    expect(selectWriter({} as SupabaseClient, undefined).kind).toBe('direct')
    expect(selectWriter({} as SupabaseClient, 'g2').kind).toBe('g2')
  })
})

describe('P1: 내 기록 읽기 — direct · g2 어느 기록이든 같은 칸으로', () => {
  function learnerDb(rows: Record<string, unknown>[]) {
    const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) }
    return { from: () => q } as unknown as SupabaseClient
  }
  it('g2 로 쓴 기록(응답 사본)도 완료 · 판정에 들어간다 · 해설 먼저는 viewed_first', async () => {
    const row = (help: 'independent' | 'viewed_first', item: string) => ({
      item_ref: item, phase: 'practice', answered_at: '2026-10-08T05:00:00Z',
      response: responseOf({ ...W, itemRef: item, helpLevel: help, extra: { preview: false, grade: { claim: true } } }),
    })
    const got = await loadMyAttempts(learnerDb([row('independent', 'A'), row('viewed_first', 'B')]), 'u1', { preview: false })
    expect(got.map((g) => [g.itemId, g.helpLevel, g.claimHit])).toEqual([['A', 'independent', true], ['B', 'viewed_first', true]])
  })
})

describe('판단을 보낸 뒤 해설 열람 — 도움 수준이 아니라 별도 행동', () => {
  it('P1-2: 열람은 시도 payload 밖 별도 행동 — 재전송 payload 가 첫 제출과 같다 · helpLevel 그대로', async () => {
    const f = fakeWriter()
    await submitPractice(deps(f.writer), { userId: 'u1', synthetic: false }, SUB)
    await submitPractice(deps(f.writer), { userId: 'u1', synthetic: false }, { ...SUB, explanationViewedAt: '2026-10-08T05:59:30.000Z' })
    expect(responseOf(f.writes[1])).toEqual(responseOf(f.writes[0]))
    expect(JSON.stringify(responseOf(f.writes[1]))).not.toContain('explanation')
    expect(f.writes[1].helpLevel).toBe('independent')
    expect(f.calls).toEqual(['reveal', 'record', 'reveal', 'record', 'explain'])
  })
  it('P1-2: g2 — 저장 성공 · 응답 유실 뒤 열람 재전송도 같은 p_response(RPC conflict 없음)', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db)
    const deps2 = { db: f.db, writer: w, pool: async () => [ENTRY], answer: async () => 5 }
    await submitPractice(deps2, { userId: 'u1', synthetic: false }, SUB)
    await submitPractice(deps2, { userId: 'u1', synthetic: false }, { ...SUB, explanationViewedAt: '2026-10-08T05:59:30.000Z' })
    const attempts = f.rpcs.filter((r) => r.fn === 'learning_attempt_record')
    expect(attempts).toHaveLength(2)
    expect(attempts[1].args).toEqual(attempts[0].args)
  })
})
