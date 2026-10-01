// apps/web/src/lib/csat/diagnosis/engine/__tests__/payload-compose.test.ts
//
// 진단 API 입력 검사와 진단 테스트 출제(역량 고르게 · 결정적)를 잠근다.

import { describe, expect, it } from 'vitest'

import { parseDiagnosticPayload, parseExamPayload, parseProfilePayload, todayKst } from '../../payload'
import { composeDiagnosticTest } from '../compose'
import type { ItemMeta } from '../types'

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

describe('parseDiagnosticPayload', () => {
  it('문항 수 상한과 문항 id 형식을 지킨다', () => {
    const a = { itemId: '2026#31', chosen: 2 }
    expect(parseDiagnosticPayload({ clientKey: KEY, answers: [a] }, 20)?.answers[0].confidence).toBe('sure')
    expect(parseDiagnosticPayload({ clientKey: KEY, answers: Array(21).fill(a) }, 20)).toBeNull()
    expect(parseDiagnosticPayload({ clientKey: KEY, answers: [{ itemId: 'x; drop', chosen: 1 }] }, 20)).toBeNull()
  })
})

describe('parseProfilePayload', () => {
  it('목표 등급 1~9 · 알 수 없는 학년 거부', () => {
    expect(parseProfilePayload({ gradeLevel: 'h1', goalType: 'susi_min', goalDetail: { min_rule: '3합6', target_grade: 2 } })?.goalDetail).toEqual({ min_rule: '3합6', target_grade: 2 })
    expect(parseProfilePayload({ gradeLevel: 'h9', goalType: 'keep' })).toBeNull()
    expect(parseProfilePayload({ gradeLevel: 'h1', goalType: 'keep', goalDetail: { target_grade: 10 } })).toBeNull()
  })
})

describe('todayKst', () => {
  it('UTC 15시 이후는 한국 날짜로 다음 날', () => {
    expect(todayKst(new Date('2026-09-30T15:30:00Z'))).toBe('2026-10-01')
  })
})

describe('composeDiagnosticTest', () => {
  const meta = (id: string, attrs: ItemMeta['attributes']): ItemMeta => ({ itemId: id, examId: 'E', no: 30, errorRate: null, ebsLinked: null, attributes: attrs, optionTraps: {} })
  const pool = [
    ...Array.from({ length: 30 }, (_, i) => meta(`E#${i}`, { A3: 2 })),
    meta('F#1', { A1: 2 }), meta('F#2', { A8: 2 }), meta('F#3', { A5: 2 }),
  ]
  it('같은 seed 면 같은 출제, 지정 문항 수를 넘지 않는다', () => {
    expect(composeDiagnosticTest(pool, 10, 7)).toEqual(composeDiagnosticTest(pool, 10, 7))
    expect(composeDiagnosticTest(pool, 10, 7)).toHaveLength(10)
  })
  it('드문 역량 문항이 먼저 뽑힌다(고르게 덮기)', () => {
    const picked = composeDiagnosticTest(pool, 5, 1)
    expect(picked).toEqual(expect.arrayContaining(['F#1', 'F#2', 'F#3']))
  })
})
