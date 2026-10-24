// apps/web/src/lib/csat/content-review/__tests__/state.test.ts
//
// F3 상태 계약 · F7 승인 계약 · F8 비파괴 원장 회귀.

import { describe, expect, it } from 'vitest'

import {
  countHumanApprovals,
  currentState,
  revert,
  staleSweep,
  transition,
  verifyLedger,
  type TransitionRequest,
} from '../state'
import type { Evidence, LedgerEntry, ReviewCandidate, Reviewer, RevisionBinding } from '../types'

const AT = '2026-10-24T00:00:00.000Z'
const binding: RevisionBinding = {
  itemId: '2015#25', itemMd5: 'aaaa', analysisVersion: 5, analysisMd5: 'bbbb', lectureVersion: 3, lectureHash: 'cccc',
}
const candidate: ReviewCandidate = {
  id: 'cr_test', itemId: '2015#25', source: 'DRAIN_MULTI_ANSWER', sourceRef: 'F3', defect: 'official_answer_conflict',
  tracks: ['official_answer', 'explanation'], binding,
  changes: [{ target: 'analysis:reject:5', current: 'distractor', proposed: 'answer', draftRef: null }],
  officialText: { verdict: 'TEXT_MATCH', note: null }, officialAnswers: [4, 5], officialAnswerBasis: 'press_verified',
  aiEvidence: ['F3 조사'], note: null,
}
const human: Reviewer = { id: 'h1', kind: 'human', roles: ['content_reviewer', 'answer_authority', 'publisher'] }
const reviewerOnly: Reviewer = { id: 'h2', kind: 'human', roles: ['content_reviewer'] }
const ai: Reviewer = { id: 'claude', kind: 'ai', roles: ['content_reviewer', 'answer_authority', 'publisher'] }

const ev = (kind: Evidence['kind'], bound = true): Evidence => ({ kind, ref: kind, boundHash: bound ? 'h' : null })
const EXPLAIN_EV = [ev('official_pdf_text'), ev('analysis_revision')]
const ANSWER_EV = [ev('official_answer_sheet')]

function req(p: Partial<TransitionRequest>): TransitionRequest {
  return { candidate, track: 'explanation', to: 'in_review', by: human, currentBinding: binding, evidence: [], reason: '시작', at: AT, ...p }
}
function apply(ledger: LedgerEntry[], p: Partial<TransitionRequest>): LedgerEntry[] {
  const r = transition(ledger, req(p))
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  return [...ledger, r.entry]
}
function approved(track: 'explanation' | 'official_answer', evidence: Evidence[], ledger: LedgerEntry[] = []) {
  const l = apply(ledger, { track, to: 'in_review' })
  return apply(l, { track, to: 'content_approved', evidence, reason: '근거 확인' })
}

describe('상태 전이', () => {
  it('처음은 검수 대기이고, 없는 전이는 거부한다', () => {
    expect(currentState([], candidate.id, 'explanation')).toBe('queued')
    const r = transition([], req({ to: 'content_approved', evidence: EXPLAIN_EV }))
    expect(r).toMatchObject({ ok: false, code: 'ILLEGAL_TRANSITION' })
  })
  it('후보에 없는 트랙은 거부한다', () => {
    expect(transition([], req({ track: 'lecture_cue' }))).toMatchObject({ ok: false, code: 'TRACK_NOT_IN_CANDIDATE' })
  })
  it('사유 없이는 바꾸지 않는다', () => {
    expect(transition([], req({ reason: '  ' }))).toMatchObject({ ok: false, code: 'REASON_REQUIRED' })
  })
})

describe('승인 계약(F7)', () => {
  it('AI 는 증거가 다 있어도 승인하지 못한다', () => {
    const l = apply([], { to: 'in_review' })
    expect(transition(l, req({ to: 'content_approved', by: ai, evidence: EXPLAIN_EV }))).toMatchObject({ ok: false, code: 'AI_CANNOT_APPROVE' })
  })
  it('AI 합의만으로는 증거가 모자란다', () => {
    const l = apply([], { to: 'in_review' })
    const r = transition(l, req({ to: 'content_approved', evidence: [ev('ai_consensus')] }))
    expect(r).toMatchObject({ ok: false, code: 'EVIDENCE_MISSING' })
  })
  it('판본에 묶이지 않은 증거는 세지 않는다', () => {
    const l = apply([], { to: 'in_review' })
    const r = transition(l, req({ to: 'content_approved', evidence: [ev('official_pdf_text', false), ev('analysis_revision')] }))
    expect(r).toMatchObject({ ok: false, code: 'EVIDENCE_MISSING' })
  })
  it('공식 정답 트랙은 answer_authority 역할이 있어야 한다', () => {
    const l = apply([], { track: 'official_answer', to: 'in_review', by: reviewerOnly })
    const r = transition(l, req({ track: 'official_answer', to: 'content_approved', by: reviewerOnly, evidence: ANSWER_EV }))
    expect(r).toMatchObject({ ok: false, code: 'ROLE_REQUIRED' })
  })
  it('공식 정답과 교육적 해설은 따로 승인된다', () => {
    const l = approved('official_answer', ANSWER_EV)
    expect(currentState(l, candidate.id, 'official_answer')).toBe('content_approved')
    expect(currentState(l, candidate.id, 'explanation')).toBe('queued')
  })
  it('판본이 바뀌면 승인하지 못한다', () => {
    const l = apply([], { to: 'in_review' })
    const r = transition(l, req({ to: 'content_approved', evidence: EXPLAIN_EV, currentBinding: { ...binding, lectureHash: 'dddd' } }))
    expect(r).toMatchObject({ ok: false, code: 'BINDING_MISMATCH' })
    if (!r.ok) expect(r.message).toContain('lectureHash')
  })
})

describe('발행 대기', () => {
  it('다른 트랙이 승인 전이면 발행 대기로 못 간다', () => {
    const l = approved('official_answer', ANSWER_EV)
    const r = transition(l, req({ track: 'official_answer', to: 'publish_pending', reason: '발행 준비' }))
    expect(r).toMatchObject({ ok: false, code: 'TRACKS_NOT_APPROVED' })
  })
  it('모든 트랙이 사람 승인이면 발행 대기로 간다 — publisher 역할 필요', () => {
    let l = approved('official_answer', ANSWER_EV)
    l = approved('explanation', EXPLAIN_EV, l)
    const noPub = transition(l, req({ track: 'explanation', to: 'publish_pending', by: reviewerOnly, reason: '발행' }))
    expect(noPub).toMatchObject({ ok: false, code: 'ROLE_REQUIRED' })
    l = apply(l, { track: 'explanation', to: 'publish_pending', reason: '발행 준비' })
    expect(currentState(l, candidate.id, 'explanation')).toBe('publish_pending')
  })
})

describe('비파괴 원장(F8)', () => {
  it('되돌림은 줄을 덧붙이고 이전 이력을 지우지 않는다', () => {
    const l = approved('explanation', EXPLAIN_EV)
    const r = revert(l, l[l.length - 1]!.seq, human, '잘못된 판본 승격', AT)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const after = [...l, r.entry]
    expect(after).toHaveLength(l.length + 1)
    expect(after.slice(0, l.length)).toEqual(l)
    expect(currentState(after, candidate.id, 'explanation')).toBe('in_review')
    expect(verifyLedger(after).ok).toBe(true)
  })
  it('같은 줄을 두 번 되돌리거나, 최신이 아닌 줄을 되돌리지 않는다', () => {
    const l = approved('explanation', EXPLAIN_EV)
    const first = revert(l, 2, human, '되돌림', AT)
    if (!first.ok) throw new Error(first.message)
    const after = [...l, first.entry]
    expect(revert(after, 2, human, '또', AT)).toMatchObject({ ok: false })
    expect(revert(l, 1, human, '옛 줄', AT)).toMatchObject({ ok: false, code: 'NOT_LATEST' })
  })
  it('AI 는 되돌리지 못한다', () => {
    const l = approved('explanation', EXPLAIN_EV)
    expect(revert(l, 2, ai, '되돌림', AT)).toMatchObject({ ok: false, code: 'AI_CANNOT_REVERT' })
  })
  it('손으로 고친 원장을 잡는다', () => {
    const l = approved('explanation', EXPLAIN_EV)
    const forged = [l[0]!, { ...l[1]!, from: 'queued' as const }]
    expect(verifyLedger(forged).ok).toBe(false)
    const aiForged = [l[0]!, { ...l[1]!, by: ai }]
    expect(verifyLedger(aiForged).problems.join()).toContain('사람 아닌 승인')
  })
})

describe('판본 무효화', () => {
  it('강의가 바뀌면 승인된 트랙도 재검수로 내려간다', () => {
    const l = approved('explanation', EXPLAIN_EV)
    const sys: Reviewer = { id: 'system', kind: 'ai', roles: [] }
    const swept = staleSweep(l, [candidate], new Map([[candidate.itemId, { ...binding, lectureHash: 'eeee' }]]), sys, AT)
    expect(swept.map((e) => [e.track, e.to])).toEqual([['official_answer', 'stale'], ['explanation', 'stale']])
    const after = [...l, ...swept]
    expect(countHumanApprovals(after)).toBe(0)
    expect(verifyLedger(after).ok).toBe(true)
  })
  it('같은 판본이면 아무것도 하지 않는다', () => {
    expect(staleSweep([], [candidate], new Map([[candidate.itemId, binding]]), human, AT)).toEqual([])
  })
})

describe('승인 수', () => {
  it('빈 원장 = 0건', () => {
    expect(countHumanApprovals([])).toBe(0)
  })
  it('사람 승인 한 트랙 = 1건', () => {
    expect(countHumanApprovals(approved('explanation', EXPLAIN_EV))).toBe(1)
  })
})
