// apps/web/src/lib/csat/diagnosis/engine/__tests__/payload-compose.test.ts
//
// 진단 API 입력 검사와 진단 테스트 출제(역량 고르게 · 결정적)를 잠근다.

import { describe, expect, it } from 'vitest'

import { parseExamPayload, todayKst } from '../../payload'
import { validateSettings } from '../settings'

const KEY = '2b1f6a0e-7c1d-4e8a-9f3b-1a2b3c4d5e6f'

describe('parseExamPayload', () => {
  const ok = { examId: 'M2609', mode: 'live', takenAt: '2026-09-02', clientKey: KEY, choices: { 1: 3, 2: null }, flags: { 2: 'guess' } }
  it('정상 입력', () => {
    expect(parseExamPayload(ok, '2026-10-01')).toMatchObject({ examId: 'M2609', choices: { 1: 3, 2: null }, flags: { 2: 'guess' }, totalMinutes: null })
  })
  it('미래 응시일 · 범위 밖 선지 · 46번 · 모르는 표시는 거부', () => {
    expect(parseExamPayload({ ...ok, takenAt: '2026-10-02' }, '2026-10-01')).toBeNull()
    expect(parseExamPayload({ ...ok, choices: { 1: 6 } }, '2026-10-01')).toBeNull()
    expect(parseExamPayload({ ...ok, choices: { 46: 1 } }, '2026-10-01')).toBeNull()
    expect(parseExamPayload({ ...ok, flags: { 1: 'maybe' } }, '2026-10-01')).toBeNull()
    expect(parseExamPayload({ ...ok, mode: 'diagnostic' }, '2026-10-01')).toBeNull()
    expect(parseExamPayload({ ...ok, clientKey: 'x' }, '2026-10-01')).toBeNull()
  })
  it('점수·정답 여부는 받지 않는다(무시된다)', () => {
    const p = parseExamPayload({ ...ok, raw: 100, isCorrect: true }, '2026-10-01') as unknown as Record<string, unknown>
    expect(p.raw).toBeUndefined()
  })
})

describe('todayKst', () => {
  it('UTC 15시 이후는 한국 날짜로 다음 날', () => {
    expect(todayKst(new Date('2026-09-30T15:30:00Z'))).toBe('2026-10-01')
  })
})

describe('validateSettings', () => {
  it('진단 테스트 문항 수는 정수여야 한다(20.5 면 21문항 출제 → 제출 거부)', () => {
    const errs = validateSettings({ diagnostic_test: { size: 20.5 } }, new Set())
    expect(errs).toContain('diagnostic_test.size 는 정수')
  })
})
