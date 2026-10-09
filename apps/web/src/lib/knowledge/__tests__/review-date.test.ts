// apps/web/src/lib/knowledge/__tests__/review-date.test.ts
// 복습 예약 날짜 — 한국 달력 기준(KST 오전 · 자정 경계 · 월말 · 연말)
import { describe, expect, it } from 'vitest'

import { kstDateOf, kstReviewDate } from '../review-date'

describe('kstReviewDate — 「N일 뒤」 = 한국 달력 날짜', () => {
  it('KST 오전 8시(UTC 전날 23시)에 1일 뒤 → 한국 내일(당일로 당겨지지 않는다 · Codex P2)', () => {
    // 2026-10-09 08:00 KST = 2026-10-08T23:00Z
    expect(kstReviewDate('2026-10-08T23:00:00.000Z', 1)).toEqual({ date: '2026-10-10', iso: '2026-10-09T15:00:00.000Z' })
  })
  it('KST 오후 · 자정 직전(23:59) · 자정 직후(00:00)', () => {
    expect(kstReviewDate('2026-10-09T06:00:00.000Z', 3).date).toBe('2026-10-12') // 15:00 KST
    expect(kstReviewDate('2026-10-09T14:59:00.000Z', 1).date).toBe('2026-10-10') // 23:59 KST 10-09
    expect(kstReviewDate('2026-10-09T15:00:00.000Z', 1).date).toBe('2026-10-11') // 00:00 KST 10-10
  })
  it('월말 · 연말 · 윤년 아닌 2월 넘김', () => {
    expect(kstReviewDate('2026-10-31T03:00:00.000Z', 1).date).toBe('2026-11-01')
    expect(kstReviewDate('2026-12-30T03:00:00.000Z', 7).date).toBe('2027-01-06')
    expect(kstReviewDate('2027-02-27T03:00:00.000Z', 3).date).toBe('2027-03-02')
  })
  it('저장 시각을 다시 KST 날짜로 읽으면 같은 날짜 — 서버 · 브라우저 · 지도가 같은 날을 보인다', () => {
    const r = kstReviewDate('2026-10-08T23:00:00.000Z', 7)
    expect(kstDateOf(r.iso)).toBe(r.date)
  })
})
