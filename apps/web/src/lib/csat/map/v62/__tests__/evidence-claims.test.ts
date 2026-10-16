// apps/web/src/lib/csat/map/v62/__tests__/evidence-claims.test.ts
//
// LM-G1.4 반례 E01–E20 — 수행 기록이 어떤 주장까지 지지하는지(evidenceView). 기존 판정(check.status)은 그대로 옮길 뿐이다.

import { describe, expect, it } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import type { ActivityRow } from '../../lifecycle-evidence'
import type { AsIsTask } from '../../v4/as-is'
import { checkKeysOfTask } from '../../v4/definition'
import { evidenceView, type EvidenceInput } from '../evidence-claims'

const KEY = checkKeysOfTask('r.central_meaning')[0]!
const H = 'hash-now'

const first = (item: string, o: Partial<FindAttemptRow> = {}): FindAttemptRow => ({
  userId: 'u', phase: 'practice', isCorrect: true, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false,
  itemRef: item, taskKey: KEY, answeredAt: '2026-10-01T00:00:00Z', activity: 'theater', ...o,
})
const act = (item: string, o: Partial<ActivityRow> = {}): ActivityRow => ({
  itemRef: item, taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: '2026-10-01T00:00:00Z',
  contentHash: H, activity: 'theater', helpLevel: 'independent', synthetic: false, receivedAt: '2026-10-01T00:00:01Z', ...o,
})
const check = (o: Partial<NonNullable<AsIsTask['check']>> = {}): AsIsTask['check'] => ({
  taskKey: KEY, status: 'unverified', independentItems: 1, attemptedItems: 1, verifiedItems: [], wrongItems: [], unseen: [], examSeen: [], verifiedAt: null, ...o,
})
const run = (o: Partial<EvidenceInput> = {}) => evidenceView({
  task: 'r.central_meaning', check: check(), firsts: [first('i1')], activity: [act('i1')], hashes: { [`${KEY}|i1`]: H, [`${KEY}|i2`]: H }, transfer: { done: 0, planned: 2 }, ...o,
})

describe('LM-G1.4 evidenceView', () => {
  it('E01 새 문항 혼자 첫 시도 → independent_check', () => {
    const v = run()
    expect(v.attempts[0]!.claim).toBe('independent_check')
    expect(v.attempts[0]!.fields.independence).toBe('CONFIRMED')
  })
  it('E02 같은 문항 반복 → 두 번째는 독립 관찰 아님', () => {
    const v = run({ activity: [act('i1'), act('i1', { answeredAt: '2026-10-02T00:00:00Z' })] })
    expect(v.attempts.map((a) => a.claim)).toEqual(['independent_check', 'condition_success'])
    expect(v.attempts[1]!.reasons.join()).toContain('반복')
  })
  it('E03 같은 지문의 다른 문항 → 공유 묶음으로 표시', () => {
    const v = run({ firsts: [first('i1'), first('i2')], activity: [act('i1', { passageKey: 'P' }), act('i2', { passageKey: 'P' })] })
    expect(v.sharedPassageGroups).toEqual([['i1', 'i2']])
  })
  it('E04 다른 과제 키 기록은 이 TASK 증거에 섞이지 않음', () => {
    const v = run({ activity: [act('i1'), act('x9', { taskKey: 'other-task' })] })
    expect(v.attempts.map((a) => a.itemRef)).toEqual(['i1'])
  })
  it('E05 도움 뒤 → INELIGIBLE', () => {
    const v = run({ firsts: [first('i1', { helpLevel: 'hint' })] })
    expect(v.attempts[0]!.fields.independence).toBe('INELIGIBLE')
    expect(v.attempts[0]!.claim).toBe('condition_success')
  })
  it('E06 해설 뒤 → INELIGIBLE', () => {
    expect(run({ firsts: [first('i1', { afterExplanation: true })] }).attempts[0]!.fields.independence).toBe('INELIGIBLE')
  })
  it('E07 시각 불확실 → 보류(held) · 실패 아님', () => {
    const a = run({ firsts: [first('i1', { timingUncertain: true })] }).attempts[0]!
    expect(a.fields.independence).toBe('UNKNOWN')
    expect(a.claim).toBe('held')
    // 먼저 보기가 확정이면 순서 불확실이어도 보류가 아니라 독립 아님
    expect(run({ firsts: [first('i1', { timingUncertain: true, helpLevel: 'viewed_first' })] }).attempts[0]!.fields.independence).toBe('INELIGIBLE')
    expect(run({ firsts: [first('i1', { helpLevel: null })] }).attempts[0]!.claim).toBe('held')
  })
  it('E08 주석 해시가 바뀜 → STALE · 새 주장 없음', () => {
    const a = run({ activity: [act('i1', { contentHash: 'old' })] }).attempts[0]!
    expect(a.fields.instrument).toBe('STALE')
    expect(a.claim).toBe('performed_only')
  })
  it('E09 루브릭 · 정책 버전은 원장에 없음 → UNKNOWN', () => {
    expect(run().attempts[0]!.fields.rubricPolicy).toBe('UNKNOWN')
    expect(run().scope?.rubricVersion).toBeNull()
  })
  it('E10 바로잡기 성공은 지금 확인 통과가 아님', () => {
    const v = run({
      check: check({ status: 'verified', verifiedAt: '2026-10-01T00:00:00Z', verifiedItems: ['i1'], wrongItems: ['i1'] }),
      activity: [act('i1', { phase: 'repair', answeredAt: '2026-10-03T00:00:00Z' })],
    })
    expect(v.instructionPath.repair).toBe('succeeded')
    expect(v.currentCheck.status).toBe('need_confirmed')
  })
  it('E11 다른 글 적용 2편은 경험이지 능력 판정 아님', () => {
    const v = run({ transfer: { done: 2, planned: 2 } })
    expect(v.newPassageTransfer).toEqual({ status: 'experienced', passages: 2 })
    expect(v.currentCheck.status).toBe('checking')
  })
  it('E12 resolved 여도 지연 유지는 NOT_ESTABLISHED', () => {
    const v = run({ check: check({ status: 'resolved' }) })
    expect(v.currentCheck.status).toBe('passed')
    expect(v.delayedRetention.status).toBe('NOT_ESTABLISHED')
  })
  it('E13 다음 날 재시도도 지연 확인이 아님', () => {
    const v = run({ activity: [act('i1'), act('i1', { answeredAt: '2026-10-02T00:00:00Z' })] })
    expect(v.delayedRetention.status).toBe('NOT_ESTABLISHED')
  })
  it('E14 120일 만료는 유지 판정이 아님', () => {
    const v = run({ check: check({ status: 'expired' }) })
    expect(v.currentCheck.status).toBe('expired')
    expect(v.delayedRetention.status).toBe('NOT_ESTABLISHED')
  })
  it('E15 계보 누락(옛 입력) → UNKNOWN', () => {
    const a = run({ activity: [{ itemRef: 'i1', taskKey: KEY, phase: 'practice', isCorrect: true, answeredAt: '2026-10-01T00:00:00Z' }] }).attempts[0]!
    expect(a.fields.performed).toBe('UNKNOWN')
    expect(a.fields.instrument).toBe('UNKNOWN')
    expect(a.fields.effectSample).toBe('UNKNOWN')
    expect(a.claim).toBe('not_counted')
  })
  it('E16 원장 못 읽음 → ledger unknown · 적용 unknown', () => {
    const v = run({ activity: undefined })
    expect(v.ledger).toBe('unknown')
    expect(v.newPassageTransfer.status).toBe('unknown')
    expect(run({ hashes: undefined }).attempts[0]!.fields.instrument).toBe('UNKNOWN')
  })
  it('E17 목표는 입력이 아님 — 같은 기록이면 같은 증거', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
  it('E18 단계 · 과제 키 접미가 섞여도 첫 시도는 단계별', () => {
    const v = run({ activity: [act('i1', { phase: 'repair' }), act('i1', { taskKey: `${KEY}-skeleton` })] })
    expect(v.attempts.map((a) => a.itemRef)).toEqual(['i1', 'i1'])
    expect(v.attempts[0]!.fields.independence).toBe('NOT_APPLICABLE')
  })
  it('E19 합성 계정 → 효과 표본 INELIGIBLE', () => {
    expect(run({ activity: [act('i1', { synthetic: true })] }).attempts[0]!.fields.effectSample).toBe('INELIGIBLE')
  })
  it('E20 적용할 글 없음 → no_content(부족 아님)', () => {
    expect(run({ check: check({ status: 'verified', verifiedAt: '2026-10-01T00:00:00Z' }), transfer: { done: 0, planned: null } }).newPassageTransfer.status).toBe('no_content')
    // 적용 단계 전(요구 확인 전)의 계획량 없음은 자료 없음이 아니다
    expect(run({ transfer: { done: 0, planned: null } }).newPassageTransfer.status).toBe('none')
  })
  it('확인 기록 없음 → 아직 확인 전', () => {
    expect(run({ check: null }).currentCheck.status).toBe('not_started')
  })
})
