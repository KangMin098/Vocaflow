// apps/web/src/lib/knowledge/__tests__/practice-server.test.ts
// /csat/practice 제출 경로 — 테스트 더블만 쓴다(DB 에 닿지 않는다). 쓰기 어댑터(direct · g2)의 멱등 · 순서 계약.
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { annotationFor, annotationHash } from '../claim-support'
import { PRACTICE_TASK, SKELETON_TASK, capabilityHits, keyFromAnnotation, type PracticeSubmission } from '../practice'
import { PracticeInputError, loadMyAttempts, schedulePracticeReview, submitPractice, type ServerEntry, type SubmitDeps } from '../practice-server'
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
        // g2 공개 전 「이미 기록된 판단인가」 조회 — rows 에 같은 (user_id · client_mutation_id) 가 있으면 그 행
        maybeSingle: async () => ({ data: rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }),
        insert: async (row: Record<string, unknown>) => (inserted.push(row), rows.push(row), { error: null }),
      }
      return q
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args })
      // 실제 RPC 의 결과 어휘: 세션 변경 = applied · duplicate · conflict / 시도 = inserted · duplicate · conflict(G2 20261008160000)
      return fn === 'learning_session_apply' ? { data: [{ session_id: 'sess-1', outcome: 'applied' }], error: null } : { data: [{ attempt_id: 1, outcome: 'inserted' }], error: null }
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

describe('g2 어댑터(G2 적용 뒤) — 원자 제출 RPC(M8-H)', () => {
  it('M8-H: 공개 · 시도를 원자 RPC 한 번으로 — reveal 은 쓰지 않고 record 가 learning_attempt_submit(판단 시각 · 공개 id 포함)', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db, { atomic: true })
    const sid = await w.reveal(W)
    expect(sid).toBeNull()
    expect(await w.record(W, sid)).toBe('inserted')
    expect(f.rpcs.map((r) => r.fn)).toEqual(['learning_attempt_submit'])
    expect(f.rpcs[0].args).toMatchObject({
      p_mutation: W.clientMutationId, p_client_session_id: W.clientSessionId, p_help_level: 'independent', p_activity: 'practice', p_answered_at: W.answeredAt,
      p_reveal_mutation: stableUuid(W.clientSessionId, 'reveal', 'independent', W.answeredAt),
    })
    expect(f.inserted).toHaveLength(0)
  })
  it('공개 id 는 도움 수준 · 판단 시각마다 다르다 — 해설을 본 뒤의 새 판단은 새 공개(도움 상승이 적용된다)', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db, { atomic: true })
    await w.record(W, null)
    await w.record({ ...W, helpLevel: 'viewed_first', clientMutationId: '00000000-0000-4000-8000-0000000000ff' }, null)
    expect(f.rpcs[1].args.p_reveal_mutation).not.toBe(f.rpcs[0].args.p_reveal_mutation)
  })
  it('P1: g2 response 에도 activity · help_level · client ids 사본 — direct 와 같은 모양', async () => {
    const f = fakeDb([])
    await g2Writer(f.db, { atomic: true }).record(W, 'sess-1')
    const d = fakeDb([])
    await directWriter(d.db).record(W, null)
    expect(f.rpcs[0].args.p_response).toEqual(responseOf(W))
    expect(d.inserted[0].response).toEqual(responseOf(W))
  })
  it('공개 변경 id 는 세션마다 결정론적 uuid', () => {
    expect(stableUuid('s', 'reveal')).toBe(stableUuid('s', 'reveal'))
    expect(stableUuid('s', 'reveal')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('기본은 g2 — G2 SQL(20261008160000) 적용 뒤 배포 순서 ③ · direct 는 되돌림용 명시 설정만', () => {
    expect(selectWriter({} as SupabaseClient, undefined).kind).toBe('g2')
    expect(selectWriter({} as SupabaseClient, 'g2').kind).toBe('g2')
    expect(selectWriter({} as SupabaseClient, 'direct').kind).toBe('direct')
  })
  it('되돌림 설정 g2-legacy 는 160000 두 RPC 계약만 부른다', async () => {
    const f = fakeDb([])
    const w = selectWriter(f.db, 'g2-legacy')
    const sid = await w.reveal(W)
    expect(await w.record(W, sid)).toBe('inserted')
    expect(f.rpcs.map((r) => r.fn)).toEqual(['learning_session_apply', 'learning_attempt_record'])
    expect(f.rpcs[1].args).toMatchObject({ p_session_id: 'sess-1', p_help_level: null, p_answered_at: W.answeredAt })
  })
  it('M8 적용 뒤 기본은 원자 RPC(learning_attempt_submit) — 같은 id 동시 요청 경쟁을 서버가 닫는다(Codex P1)', async () => {
    const f = fakeDb([])
    const w = selectWriter(f.db, undefined)
    await w.record(W, await w.reveal(W))
    expect(f.rpcs.map((r) => r.fn)).toEqual(['learning_attempt_submit'])
  })
  it('M8-H: reveal 은 따로 세션을 쓰지 않는다 — 같은 제출 id 의 동시 · 재전송 판정은 서버 원자 RPC 가 잠금으로 한다', async () => {
    const { db, rpcs } = fakeDb([])
    await g2Writer(db, { atomic: true }).reveal({ ...W, helpLevel: 'viewed_first' })
    expect(rpcs).toHaveLength(0)
  })

  it('B8: 해설 열람은 공개 · 판단과 다른 mutation id 로 learning_session_apply(p_explanation_viewed_at) · 같은 열람 재전송은 같은 id', async () => {
    const f = fakeDb([])
    const w = g2Writer(f.db, { atomic: true })
    await w.reveal(W)
    await w.record(W, 'sess-1')
    await w.noteExplanationView(W, '2026-10-08T06:10:00.000Z', 'sess-1')
    await w.noteExplanationView(W, '2026-10-08T06:10:00.000Z', 'sess-1')
    const applies = f.rpcs.filter((r) => r.fn === 'learning_session_apply')
    const explain = applies[0].args, again = applies[1].args
    const attempt = f.rpcs.find((r) => r.fn === 'learning_attempt_submit')!.args
    expect(explain.p_explanation_viewed_at).toBe('2026-10-08T06:10:00.000Z')
    expect(explain.p_mutation).not.toBe(attempt.p_reveal_mutation)
    expect(explain.p_mutation).not.toBe(attempt.p_mutation)
    expect(again.p_mutation).toBe(explain.p_mutation)
    expect(explain.p_client_session_id).toBe(W.clientSessionId)
    expect(JSON.stringify(attempt.p_response)).not.toContain('explanation')
  })
  it('B8: 해설 열람 기록이 conflict · 오류면 조용히 넘기지 않는다(예외)', async () => {
    const db = { rpc: async () => ({ data: [{ session_id: 's', outcome: 'conflict' }], error: null }) } as unknown as SupabaseClient
    await expect(g2Writer(db).noteExplanationView(W, '2026-10-08T06:10:00.000Z', 's')).rejects.toThrow('해설 열람 기록 실패')
  })
})

describe('P1: 내 기록 읽기 — direct · g2 어느 기록이든 같은 칸으로', () => {
  function learnerDb(rows: Record<string, unknown>[], firsts: Record<string, unknown>[] = []) {
    const mk = (data: Record<string, unknown>[]) => { const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: async () => ({ data, error: null }) }; return q }
    return { from: (t: string) => mk(t === 'learning_first_attempts' ? firsts : rows) } as unknown as SupabaseClient
  }
  it('M8 실효 도움 — 저장값이 independent 여도 첫 시도 뷰가 도움 뒤 · 해설 뒤 · 시각 불확실이면 역량 판정에서 독립이 아니다', async () => {
    const base = { task_key: PRACTICE_TASK, phase: 'practice', activity: 'practice', help_level: 'independent', answered_at: '2026-10-08T05:00:00Z', response: { grade: { claim: true } } }
    const got = await loadMyAttempts(learnerDb(
      [{ ...base, id: 1, item_ref: 'A' }, { ...base, id: 2, item_ref: 'B' }, { ...base, id: 3, item_ref: 'C' }, { ...base, id: 4, item_ref: 'D' }],
      [
        { attempt_id: 1, help_level: 'viewed_first', after_explanation: false, timing_uncertain: false },
        { attempt_id: 2, help_level: 'independent', after_explanation: true, timing_uncertain: false },
        { attempt_id: 3, help_level: 'independent', after_explanation: false, timing_uncertain: true },
        { attempt_id: 4, help_level: 'independent', after_explanation: false, timing_uncertain: false },
      ],
    ), 'u1', { preview: false })
    expect(got.map((g) => [g.itemId, g.helpLevel])).toEqual([['A', 'viewed_first'], ['B', 'viewed_first'], ['C', 'viewed_first'], ['D', 'independent']])
  })
  it('G2 전 직접 기록(뷰 help_level NULL)은 저장값으로 판단 — independent 를 viewed_first 로 덮지 않는다(Codex P2)', async () => {
    const got = await loadMyAttempts(learnerDb(
      [{ id: 9, task_key: PRACTICE_TASK, item_ref: 'L', phase: 'practice', help_level: null, activity: null, answered_at: '2026-10-08T05:00:00Z', response: { activity: 'practice', help_level: 'independent', grade: { claim: true } } }],
      [{ attempt_id: 9, help_level: null, after_explanation: false, timing_uncertain: false }],
    ), 'u1', { preview: false })
    expect(got.map((g) => g.helpLevel)).toEqual(['independent'])
  })
  it('같은 과제 · 문항 · 단계의 첫 판단이 해설 극장이면 Practice 재풀이는 첫 시도가 아니다(DB 뷰와 같은 키)', async () => {
    const base = { task_key: PRACTICE_TASK, item_ref: 'A', phase: 'practice', help_level: 'independent', response: { grade: { claim: true } } }
    const got = await loadMyAttempts(learnerDb([
      { ...base, id: 1, answered_at: '2026-10-08T04:00:00Z', activity: 'theater', help_level: 'viewed_first' },
      { ...base, id: 2, answered_at: '2026-10-08T05:00:00Z', activity: 'practice' },
      { ...base, id: 3, item_ref: 'B', answered_at: '2026-10-08T05:00:00Z', activity: 'practice' },
    ]), 'u1', { preview: false })
    // 완료 · 이력에는 둘 다 남고, A 는 첫 판단이 극장이라 역량 판정에서만 빠진다
    expect(got.map((g) => [g.itemId, g.firstElsewhere])).toEqual([['A', true], ['B', false]])
    expect(capabilityHits(got)).toEqual([true])
  })
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
    const w = g2Writer(f.db, { atomic: true })
    const deps2 = { db: f.db, writer: w, pool: async () => [ENTRY], answer: async () => 5 }
    await submitPractice(deps2, { userId: 'u1', synthetic: false }, SUB)
    await submitPractice(deps2, { userId: 'u1', synthetic: false }, { ...SUB, explanationViewedAt: '2026-10-08T05:59:30.000Z' })
    const attempts = f.rpcs.filter((r) => r.fn === 'learning_attempt_submit')
    expect(attempts).toHaveLength(2)
    expect(attempts[1].args).toEqual(attempts[0].args)
  })
})

describe('E11 복습 예약 — 판정 뒤 다시 보기(학습 지도 「다시 보기」 → 확인 과제 재평가)', () => {
  const FIN = '2026-10-09T03:00:00.000Z'
  it('세션을 finished 로 마치고 review_at = N일 뒤 날짜 · 재전송은 같은 mutation · 같은 payload(p_at 고정 · Codex P1)', async () => {
    const f = fakeDb([{ user_id: 'u1', client_session_id: SUB.clientSessionId, review_at: '2026-10-11T15:00:00+00:00' }])
    const d = { ...deps(fakeWriter().writer), db: f.db }
    const r = await schedulePracticeReview(d, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 3, finishedAt: FIN, preview: false })
    await schedulePracticeReview(d, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 3, finishedAt: FIN, preview: false })
    expect(r).toMatchObject({ reviewAt: '2026-10-11T15:00:00.000Z', reviewDate: '2026-10-12', kept: false })
    const calls = f.rpcs.filter((x) => x.fn === 'learning_session_apply')
    expect(calls[0].args).toMatchObject({ p_stage: 'finished', p_review_at: '2026-10-11T15:00:00.000Z', p_client_session_id: SUB.clientSessionId, p_activity: 'practice', p_help_level: null })
    expect(calls[1].args).toEqual(calls[0].args)
  })
  it('닫힌 간격(1 · 3 · 7일)만 · 풀에 없는 문항은 404', async () => {
    const d = { ...deps(fakeWriter().writer), db: fakeDb([]).db }
    await expect(schedulePracticeReview(d, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 30, finishedAt: FIN, preview: false })).rejects.toBeInstanceOf(PracticeInputError)
    await expect(schedulePracticeReview(d, { userId: 'u1', synthetic: false }, { itemId: 'nope#1', clientSessionId: SUB.clientSessionId, days: 1, finishedAt: FIN, preview: false })).rejects.toMatchObject({ status: 404 })
  })
})

describe('E11 복습 예약 — 서버 확정 날짜(KST) · 재전송 정합(Codex P2)', () => {
  const FIN = '2026-10-08T23:00:00.000Z' // KST 2026-10-09 08:00
  it('KST 오전에 1일 뒤 → 한국 내일(10-10) · 저장은 그 날 KST 00:00', async () => {
    const f = fakeDb([{ user_id: 'u1', client_session_id: SUB.clientSessionId, review_at: '2026-10-09T15:00:00+00:00' }])
    const r = await schedulePracticeReview({ ...deps(fakeWriter().writer), db: f.db }, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 1, finishedAt: FIN, preview: false })
    expect(r).toMatchObject({ reviewDate: '2026-10-10', requestedDate: '2026-10-10', reviewAt: '2026-10-09T15:00:00.000Z', kept: false })
  })
  it('이미 다른 날로 확정돼 있으면(응답 유실 뒤 다른 간격 재시도) 저장된 날짜를 돌려준다 — 요청 날짜로 덮지 않는다', async () => {
    const f = fakeDb([{ user_id: 'u1', client_session_id: SUB.clientSessionId, review_at: '2026-10-11T15:00:00+00:00' }])
    const r = await schedulePracticeReview({ ...deps(fakeWriter().writer), db: f.db }, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 7, finishedAt: FIN, preview: false })
    expect(r).toMatchObject({ reviewDate: '2026-10-12', requestedDate: '2026-10-16', kept: true })
  })
})

describe('선행 해설 열람은 다른 세션이어도 이어 붙는다(Codex P1)', () => {
  it('같은 문항에 앞선 도움 · 해설 열람이 있으면 화면이 independent 로 보내도 viewed_first 로 기록', async () => {
    const f = fakeWriter()
    await submitPractice({ ...deps(f.writer), priorHelp: async () => true }, { userId: 'u1', synthetic: false }, SUB)
    expect(f.writes[0].helpLevel).toBe('viewed_first')
  })
  it('앞선 도움이 없으면 independent 그대로', async () => {
    const f = fakeWriter()
    await submitPractice({ ...deps(f.writer), priorHelp: async () => false }, { userId: 'u1', synthetic: false }, SUB)
    expect(f.writes[0].helpLevel).toBe('independent')
  })
  it('예약 확정 날짜를 읽지 못하면 확정이라고 말하지 않는다(오류)', async () => {
    await expect(schedulePracticeReview({ ...deps(fakeWriter().writer), db: fakeDb([]).db }, { userId: 'u1', synthetic: false }, { itemId: SUB.itemId, clientSessionId: SUB.clientSessionId, days: 1, finishedAt: '2026-10-08T23:00:00.000Z', preview: false })).rejects.toThrow('확인 실패')
  })
})
