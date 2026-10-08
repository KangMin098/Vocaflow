// apps/web/src/lib/csat/map/__tests__/goal-view.test.ts
import { describe, expect, it } from 'vitest'

import { evidenceCounts, goalSummary, gradeBand, gradeOf, stepGoalLink } from '../goal-view'

describe('영어 절대평가 등급', () => {
  it('10점 구간 — 90↑ 1 · 80~89 2 · 70~79 3 … 20 미만 9', () => {
    expect([100, 90, 89, 80, 79, 70, 60, 50, 40, 30, 20, 19, 0].map(gradeOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 9])
  })
  it('구간 문구', () => {
    expect(gradeBand(1)).toBe('90점 이상')
    expect(gradeBand(2)).toBe('80~89점')
    expect(gradeBand(9)).toBe('20점 미만')
  })
})

const rec = (takenAt: string, raw: number | null, grade: number | null = null) => ({ label: `시험 ${takenAt}`, takenAt, raw, grade })

describe('목표 · 현재 위치', () => {
  it('목표를 정하지 않았으면 goalSet=false · 거리 없음(기본값을 정한 목표처럼 쓰지 않는다)', () => {
    const g = goalSummary({ goal: 100, goalSet: false }, [rec('2026-09-20', 70)])
    expect(g.goalSet).toBe(false)
    expect(g.gap).toBeNull()
  })
  it('기록이 없으면 현재 위치 · 거리 없음(가상의 위치를 만들지 않는다)', () => {
    const g = goalSummary({ goal: 80, goalSet: true }, [])
    expect(g.latest).toBeNull()
    expect(g.gap).toBeNull()
    expect(g.goalGrade).toBe(2)
  })
  it('최근 기록 · 이전 기록 · 거리는 실제 원점수로만', () => {
    const g = goalSummary({ goal: 80, goalSet: true }, [rec('2026-09-06', 63), rec('2026-09-27', 74)])
    expect(g.latest).toMatchObject({ raw: 74, grade: 3 })
    expect(g.previous).toMatchObject({ raw: 63, grade: 4 })
    expect(g.gap).toBe(6)
  })
  it('기록에 저장된 등급이 있으면 그것을 쓴다 · 원점수 없는 기록은 세지 않는다', () => {
    const g = goalSummary({ goal: 90, goalSet: true }, [rec('2026-09-06', null), rec('2026-09-27', 85, 2)])
    expect(g.recordCount).toBe(1)
    expect(g.latest).toMatchObject({ raw: 85, grade: 2 })
    expect(g.previous).toBeNull()
  })
  it('목표를 넘으면 거리 0', () => expect(goalSummary({ goal: 70, goalSet: true }, [rec('2026-09-27', 88)]).gap).toBe(0))
})

describe('단계와 목표의 관계(기준 시험 사실)', () => {
  const model = {
    reference: { exams: [{ id: 'X', label: 'X' }, { id: 'Y', label: 'Y' }], shortfall: 0, wanted: 2, skipped: [] },
    lineRefItems: {
      A3: [{ examId: 'X', no: 36, points: 2, errorRate: null }, { examId: 'Y', no: 37, points: 3, errorRate: null }],
      B11: [{ examId: 'X', no: 36, points: 2, errorRate: null }, { examId: 'Y', no: 39, points: 2, errorRate: null }],
    },
  }
  it('라인이 겹쳐도 같은 문항은 한 번만 · 회당 평균', () => {
    expect(stepGoalLink({ lines: ['A3', 'B11'] }, model)).toEqual({ exams: 2, itemsPerExam: 1.5, pointsPerExam: 3.5 })
  })
  it('연결 문항이 없거나 기준 시험이 없으면 null', () => {
    expect(stepGoalLink({ lines: ['Z9'] }, model)).toBeNull()
    expect(stepGoalLink({ lines: ['A3'] }, { ...model, reference: { ...model.reference, exams: [] } })).toBeNull()
  })
})

describe('진단상 위치 — 네 갈래로 센다', () => {
  it('관찰 · 먼저 확인 · 근거 부족(기록 없음 · 분석 준비 중 · 기록 더 필요) · 직접 확인', () => {
    expect(evidenceCounts([{ evidence: 'observed' }, { evidence: 'focus' }, { evidence: 'none' }, { evidence: 'pending' }, { evidence: 'more' }, { evidence: 'verified' }]))
      .toEqual({ observed: 1, check: 1, thin: 3, verified: 1 })
  })
})
