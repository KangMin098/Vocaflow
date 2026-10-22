// apps/web/src/lib/knowledge/__tests__/trial-evidence-display.test.ts
// T-0085 — 효과 검증 표시: 현재 분석 · 재계산 필요 · 합성 · 비합성 표시 · 확인 불가와 효과 입증을 구분한다(DB 없음)
import { describe, expect, it } from 'vitest'

import { opsSummary, TRIAL_EVIDENCE_LABEL, trialEvidenceCounts, trialEvidenceState, type TrialEvidenceInput } from '../vnext-rules'

const app = (trials: TrialEvidenceInput[], status: 'active' | 'draft' = 'active') => ({ id: 'a', itemId: 'i', status, surfaceRef: 'fixture', statusReason: null, trials })
const verification = (trials: TrialEvidenceInput[]) =>
  opsSummary({ items: [], evidence: [], inquiries: [], applications: [app(trials)], openGaps: 0 }).stages.find((s) => s.key === 'verification')!

describe('trialEvidenceState — 기존 DTO 세 필드만', () => {
  it('명시 비합성 · analyzed · 재계산 표지 null = current(결과 종류와 무관)', () => {
    for (const result of ['supported', 'mixed', 'not_supported', 'inconclusive', null]) {
      expect(trialEvidenceState({ status: 'analyzed', synthetic: false, reviewRequiredAt: null, ...{ result } } as TrialEvidenceInput)).toBe('current')
    }
  })
  it('재계산 필요 = stale · 합성 = synthetic · 계획/진행 = pending', () => {
    expect(trialEvidenceState({ status: 'analyzed', synthetic: false, reviewRequiredAt: '2026-10-22T00:00:00Z' })).toBe('stale')
    expect(trialEvidenceState({ status: 'analyzed', synthetic: true, reviewRequiredAt: null })).toBe('synthetic')
    expect(trialEvidenceState({ status: 'planned', synthetic: false, reviewRequiredAt: null })).toBe('pending')
    expect(trialEvidenceState({ status: 'running', synthetic: false, reviewRequiredAt: null })).toBe('pending')
  })
  it('표지 누락 · null · 잘못된 값 = unknown(합성도 실제 0 도 추정하지 않는다)', () => {
    expect(trialEvidenceState({ status: 'analyzed', synthetic: false })).toBe('unknown') // 재계산 표지 누락
    expect(trialEvidenceState({ status: 'analyzed', reviewRequiredAt: null })).toBe('unknown') // 합성 표지 누락
    expect(trialEvidenceState({ status: 'analyzed', synthetic: null, reviewRequiredAt: null })).toBe('unknown')
    expect(trialEvidenceState({ status: 'analyzed', synthetic: 'false' as never, reviewRequiredAt: null })).toBe('unknown')
    expect(trialEvidenceState({ status: 'analyzed', synthetic: false, reviewRequiredAt: '' })).toBe('unknown')
  })
  it('재계산 뒤(표지 해제) = 다시 current', () => {
    const before = { status: 'analyzed', synthetic: false, reviewRequiredAt: '2026-10-22T00:00:00Z' } as const
    expect(trialEvidenceState(before)).toBe('stale')
    expect(trialEvidenceState({ ...before, reviewRequiredAt: null })).toBe('current')
  })
  it('문구 — 현재 분석도 효과 입증 · 실제 참가자 확인이 아니라고 말한다', () => {
    expect(TRIAL_EVIDENCE_LABEL.current).toMatch(/효과 입증 · 실제 참가자 확인 아님/)
    expect(TRIAL_EVIDENCE_LABEL.stale).toContain('재계산 필요')
    expect(Object.values(TRIAL_EVIDENCE_LABEL).join(' ')).not.toMatch(/실제 학습자/)
  })
})

describe('opsSummary 효과 검증 단계', () => {
  it('Codex 반례 — 재계산 필요 analyzed(false) = 현재 분석 0 · 노트에 재계산 1 명시', () => {
    const v = verification([{ status: 'analyzed', synthetic: false, reviewRequiredAt: '2026-10-22T00:00:00Z' }])
    expect(v.value).toBe(0)
    expect(v.note).toContain('재계산 필요 1')
  })
  it('Codex 반례 — 비합성 메타만으로 실제 학습자라 말하지 않는다', () => {
    expect(verification([{ status: 'analyzed', synthetic: false, reviewRequiredAt: null }]).note).not.toContain('실제 학습자')
  })
  it('대조 — 합성 분석 0 · 현행 비합성 분석 1 · 확인 불가는 0 이 아니라 따로 센다', () => {
    expect(verification([{ status: 'analyzed', synthetic: true, reviewRequiredAt: null }]).value).toBe(0)
    expect(verification([{ status: 'analyzed', synthetic: false, reviewRequiredAt: null }]).value).toBe(1)
    const u = verification([{ status: 'analyzed', synthetic: null, reviewRequiredAt: null }, { status: 'analyzed', synthetic: false }])
    expect(u.value).toBe(0)
    expect(u.note).toContain('확인 불가 2')
  })
  it('계획만 있음 = 분석 0 · 병목은 검증 단계', () => {
    expect(verification([{ status: 'planned', synthetic: false, reviewRequiredAt: null }]).value).toBe(0)
    expect(trialEvidenceCounts([{ status: 'planned', synthetic: false, reviewRequiredAt: null }]).pending).toBe(1)
  })
  it('큐 — 재계산 필요 분석을 숨기지 않는다 · 확인 불가만 있는 적용은 비합성 계획 없음', () => {
    const q = opsSummary({ items: [], evidence: [], inquiries: [], applications: [app([{ status: 'analyzed', synthetic: false, reviewRequiredAt: '2026-10-22T00:00:00Z' }])], openGaps: 0 }).queue
    expect(q.some((e) => e.title.includes('재계산 필요한 분석 — fixture'))).toBe(true)
    const q2 = opsSummary({ items: [], evidence: [], inquiries: [], applications: [app([{ status: 'analyzed', synthetic: null, reviewRequiredAt: null }])], openGaps: 0 }).queue
    expect(q2.some((e) => e.title.includes('비합성 검증 계획 없는 적용'))).toBe(true)
  })
})
