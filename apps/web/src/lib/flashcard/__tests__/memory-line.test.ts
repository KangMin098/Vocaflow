// apps/web/src/lib/flashcard/__tests__/memory-line.test.ts
import { describe, expect, it } from 'vitest'

import { applyReview, Rating, type SrsCard } from '@/lib/srs/fsrs'

import { buildMemoryLine, formatDue } from '../memory-line'

const NOW = new Date('2026-09-19T00:00:00Z')
const DAY = 86_400_000

const fresh: SrsCard = {
  id: 'n',
  difficulty: 0,
  stability: 0,
  lastReviewAt: null,
  nextReviewAt: null,
  moduleHistory: [],
  reviewCount: 0,
}
const faded: SrsCard = {
  id: 'f',
  difficulty: 6,
  stability: 4,
  lastReviewAt: new Date(NOW.getTime() - 12 * DAY),
  nextReviewAt: new Date(NOW.getTime() - 8 * DAY),
  moduleHistory: [],
  reviewCount: 3,
}

describe('buildMemoryLine', () => {
  it('새 낱말 — 지난 선이 없고 상태는 new', () => {
    const line = buildMemoryLine(fresh, NOW)
    expect(line.state).toBe('new')
    expect(line.sinceDays).toBeNull()
    expect(line.past).toEqual([])
  })

  it('흐려진 낱말 — 지난 선은 지난 복습(1)에서 오늘(R 낮음)으로 내려간다', () => {
    const line = buildMemoryLine(faded, NOW)
    expect(line.sinceDays).toBeCloseTo(12, 5)
    expect(line.past[0].d).toBeCloseTo(-12, 5)
    expect(line.past[0].r).toBeCloseTo(1, 5)
    const today = line.past[line.past.length - 1]
    expect(today.d).toBe(0)
    expect(today.r).toBeCloseTo(Math.pow(0.9, 12 / 4), 5)
  })

  it('평가 미리보기는 세션이 적용하는 applyReview 와 같은 다음 만남을 말한다', () => {
    const line = buildMemoryLine(faded, NOW)
    const good = line.previews.find((p) => p.rating === 'good')!
    const applied = applyReview({ card: faded, rating: Rating.Good, module: 'flashcard', reviewedAt: NOW }).card
    expect(good.dueInDays).toBeCloseTo((applied.nextReviewAt!.getTime() - NOW.getTime()) / DAY, 5)
    // 평가가 쉬울수록 다음 만남은 멀다
    const due = Object.fromEntries(line.previews.map((p) => [p.rating, p.dueInDays]))
    expect(due.again).toBeLessThanOrEqual(due.hard)
    expect(due.hard).toBeLessThanOrEqual(due.good)
    expect(due.good).toBeLessThanOrEqual(due.easy)
  })

  it('미래 곡선은 오늘 1 에서 시작해 내려가고, 축은 [7, 60] 일', () => {
    const line = buildMemoryLine(faded, NOW)
    for (const p of line.previews) {
      expect(p.curve[0]).toEqual({ d: 0, r: 1 })
      expect(p.curve[p.curve.length - 1].r).toBeLessThan(1)
    }
    expect(line.horizon).toBeGreaterThanOrEqual(7)
    expect(line.horizon).toBeLessThanOrEqual(60)
  })

  it('지난 선은 최대 30일만 그린다', () => {
    const old = { ...faded, lastReviewAt: new Date(NOW.getTime() - 200 * DAY) }
    expect(buildMemoryLine(old, NOW).past[0].d).toBeCloseTo(-30, 5)
  })
})

describe('formatDue', () => {
  it('분 · 시간 · 일 · 개월', () => {
    expect(formatDue(5 / (24 * 60))).toBe('5분 뒤')
    expect(formatDue(0.25)).toBe('6시간 뒤')
    expect(formatDue(2.4)).toBe('2일 뒤')
    // 흔들림(fuzz)이 있는 간격에는 「약」
    expect(formatDue(3.4)).toBe('약 3일 뒤')
    expect(formatDue(90)).toBe('약 3개월 뒤')
  })
})

describe('sessionCurves', () => {
  it('새 낱말을 오늘 본 세션 — 기준선 0, 본 뒤는 오늘 N 에서 내려간다', async () => {
    const { sessionCurves } = await import('../memory-line')
    const after = applyReview({ card: fresh, rating: Rating.Good, module: 'flashcard', reviewedAt: NOW }).card
    const c = sessionCurves([{ before: fresh, after }, { before: fresh, after }], NOW)
    expect(c.base).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(c.after[0]).toBeCloseTo(2, 5)
    expect(c.after[7]).toBeLessThan(c.after[0])
  })
})
