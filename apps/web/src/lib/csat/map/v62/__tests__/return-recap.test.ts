// apps/web/src/lib/csat/map/v62/__tests__/return-recap.test.ts — T-0062: 돌아온 뒤 정리는 기록만 읽고, 못 읽으면 모른다고 한다
import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import type { ActivityRow } from '../../lifecycle-evidence'
import { returnSummary } from '../learner-guide'
import { returnRecap, transferLine } from '../return-recap'

const KEY = 'authored-evidence-locate'
const att = (o: Partial<FindAttemptRow>): FindAttemptRow => ({ userId: 'u', itemRef: 'authored:ev-ind-1', taskKey: KEY, phase: 'practice', isCorrect: false, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, answeredAt: '2026-10-20T01:00:00.000Z', activity: 'theater', sessionId: 's', contentHash: 'c', expectedContentHash: 'c', ...o })
const act = (o: Partial<ActivityRow>): ActivityRow => ({ itemRef: 'authored:ev-guided-1', taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: '2026-10-20T02:00:00.000Z', activity: 'practice', ...o })
const REF = 'authored:ev-ind-1'
const base = { keys: [KEY], activityRef: REF as string | null, attempts: [] as FindAttemptRow[], activity: [] as ActivityRow[], transfer: { transferDone: 0, transferPlanned: 2 }, history: [], proposalDiffers: false }
const ver = (version: number, reason: 'initial' | 'check_result' | 'content_change', goalVersionId: number | null = 10) => ({ version, reason, goalVersionId, plan: { order: [], tasks: [] }, note: null, restoredFrom: null, canon: 'x', asOf: '', createdAt: '' }) as never

describe('returnRecap — 적용 0 · 일부 · 계획만큼 · 확인 불가', () => {
  it.each([
    [0, 2, 'none', '아직 없어요'],
    [1, 2, 'partial', '1 / 2편 — 아직 계획만큼 하지 않았어요'],
    [2, 2, 'complete', '2 / 2편 — 계획만큼'],
  ])('%i/%i → %s', (done, planned, state, text) => {
    const r = returnRecap({ ...base, transfer: { transferDone: done, transferPlanned: planned } })
    expect(r.transfer.state).toBe(state)
    expect(transferLine(r.transfer)).toContain(text)
  })
  it('근거를 못 읽으면 확인 불가 — 0 · 기록 없음으로 바꾸지 않는다', () => {
    const r = returnRecap({ ...base, transfer: undefined })
    expect(r.transfer.state).toBe('unknown')
    expect(transferLine(r.transfer)).toContain('확인할 수 없어요')
  })
})

describe('returnRecap — 가장 최근 기록과 근거 채택', () => {
  it('처음 보는 문항 혼자 오답 → 독립 근거로 셈', () => {
    const r = returnRecap({ ...base, attempts: [att({})] })
    expect(r.latest).toMatchObject({ state: 'found', kind: 'independent_counted', isCorrect: false })
  })
  it('그 뒤 안내 연습 정답 → 최근 = 안내 연습(독립 근거 아님) — 독립 근거 수를 늘리지 않는다', () => {
    const r = returnRecap({ ...base, activityRef: 'authored:ev-guided-1', attempts: [att({})], activity: [act({})] })
    expect(r.latest).toMatchObject({ state: 'found', kind: 'guided', isCorrect: true })
  })
  it('해설을 먼저 본 풀이는 셌다고 말하지 않는다', () => {
    const r = returnRecap({ ...base, attempts: [att({ afterExplanation: true, helpLevel: 'viewed_first' })] })
    expect(r.latest).toMatchObject({ kind: 'not_counted_helped' })
  })
  it('세지 않은 이유는 기록 표지 그대로 — 시각 불확실 · 결속 미확인', () => {
    expect(returnRecap({ ...base, attempts: [att({ timingUncertain: true })] }).latest).toMatchObject({ kind: 'not_counted_timing' })
    expect(returnRecap({ ...base, attempts: [att({ contentHash: null })] }).latest).toMatchObject({ kind: 'not_counted_unbound' })
  })
  it('다른 TASK 기록은 섞지 않는다 · 기록 없음 = none · 조회 실패 = unknown', () => {
    expect(returnRecap({ ...base, attempts: [att({ taskKey: 'other' })] }).latest.state).toBe('unidentified')
    expect(returnRecap({ ...base, attempts: undefined }).latest.state).toBe('unknown')
    expect(returnRecap({ ...base, activity: undefined }).latest.state).toBe('unknown')
  })
})

describe('returnRecap · returnSummary — 저장 계획 버전 · 제안', () => {
  it('최신 · 직전 버전과 이유 · 지금 재계산이 다르면 제안 · 버전 증가는 실력 변화가 아니라고 말한다', () => {
    const recap = returnRecap({ ...base, history: [ver(3, 'check_result'), ver(2, 'content_change')], proposalDiffers: true })
    expect(recap.plan).toMatchObject({ version: 3, prev: { version: 2 }, proposalDiffers: true })
    const out = returnSummary({ check: null, taskDisplay: 'E2', recap, remaining: 'x', nextLabel: null, notes: [], planVersion: 3, goalVersion: 5 }).join(' ')
    expect(out).toContain('v3')
    expect(out).toContain('직전 v2')
    expect(out).toContain('실력 변화가 아니에요')
    expect(out).toContain('제안이에요')
  })
  it('저장 계획 없음 → plan null(기존 문구) · 같으면 「같아요」', () => {
    expect(returnRecap(base).plan).toBeNull()
    const same = returnRecap({ ...base, history: [ver(1, 'initial')] })
    expect(returnSummary({ check: null, taskDisplay: 'E2', recap: same, remaining: 'x', nextLabel: null, notes: [], planVersion: 1, goalVersion: null }).join(' ')).toContain('같아요')
  })
  it('최근 기록을 못 읽으면 이번 활동 반영 여부를 말하지 않는다', () => {
    const out = returnSummary({ check: null, taskDisplay: 'E2', recap: returnRecap({ ...base, attempts: undefined }), remaining: 'x', nextLabel: null, notes: [], planVersion: null, goalVersion: null }).join(' ')
    expect(out).toContain('읽지 못했어요')
  })
})

describe('T-0062 rework — 이번 활동 식별(F1) · 원장 조회 실패(F2) · 저장 당시 목표(F3)', () => {
  it('F1 문맥의 자료와 다른 같은 TASK 의 더 늦은 수행 B 는 이번 활동이 아니다', () => {
    const later = att({ itemRef: 'authored:ev-ind-2', isCorrect: true, answeredAt: '2026-10-20T05:00:00.000Z' })
    const r = returnRecap({ ...base, attempts: [att({}), later] })
    expect(r.latest).toMatchObject({ state: 'found', isCorrect: false })
  })
  it('F1 문맥이 없거나(옛 복귀 URL) 본인 · 이 TASK 기록에 그 자료가 없으면 unidentified — 누적 최신으로 대신하지 않는다', () => {
    expect(returnRecap({ ...base, activityRef: null, attempts: [att({})] }).latest.state).toBe('unidentified')
    expect(returnRecap({ ...base, activityRef: 'authored:someone-else', attempts: [att({})] }).latest.state).toBe('unidentified')
    const out = returnSummary({ check: null, taskDisplay: 'E2', recap: returnRecap({ ...base, activityRef: null }), remaining: 'x', nextLabel: null, notes: [], planVersion: null, goalVersion: null }).join(' ')
    expect(out).toContain('이번 활동을 특정하지 못했어요')
  })
  it('F2 원장 ledger unknown 이면 instructionPath 0 이어도 확인 불가', () => {
    const r = returnRecap({ ...base, transfer: { transferDone: 0, transferPlanned: 2 }, ledger: 'unknown' })
    expect(r.transfer.state).toBe('unknown')
    expect(transferLine(r.transfer)).toContain('확인할 수 없어요')
  })
  it('F3 저장 당시 목표 v10 · 지금 목표 v11 을 섞지 않는다', () => {
    const recap = returnRecap({ ...base, history: [ver(3, 'check_result', 10), ver(2, 'content_change', 9)] })
    const out = returnSummary({ check: null, taskDisplay: 'E2', recap, remaining: 'x', nextLabel: null, notes: [], planVersion: 3, goalVersion: 11 }).join(' ')
    expect(out).toContain('저장 당시 목표 v10')
    expect(out).toContain('저장 당시 목표 v9')
    expect(out).toContain('지금 목표는 v11')
    expect(out).not.toMatch(/v3\([^)]*목표 v11/)
  })
})
