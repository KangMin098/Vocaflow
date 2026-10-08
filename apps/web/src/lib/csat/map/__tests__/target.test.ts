// apps/web/src/lib/csat/map/__tests__/target.test.ts
//
// 학습 지도 목표율 · 상태 계산 — G=100 전부 반드시 · 손실 예산 경계 · 오답률 결측 · 분모 0 · 보수적 집계 상태.

import { describe, expect, it } from 'vitest'

import {
  aggregate,
  completionRate,
  itemKey,
  lineStatus,
  lineTarget,
  selectReferenceExams,
  splitMust,
  type ExamCandidate,
  type RefItem,
} from '../target'

const item = (no: number, points: number, errorRate: number | null, examId = 'E'): RefItem => ({ examId, no, points, errorRate })

describe('splitMust', () => {
  const items = [item(1, 2, 0.1), item(2, 3, 0.9), item(3, 3, 0.8), item(4, 2, 0.5), item(5, 2, null)]

  it('만점(G=100)이면 오답률과 무관하게 전부 반드시', () => {
    const r = splitMust(items, 100)
    expect(r.skip.size).toBe(0)
    expect(r.must.size).toBe(5)
  })

  it('오답률 높은 순으로 잃어도 되는 점수까지만 놓쳐도 됨으로 배정', () => {
    const r = splitMust(items, 95) // L=5 → 2번(3점) + 4번(2점)? 3·0.9 먼저, 다음 3·0.8 은 6 > 5 라 못 들어가고 4번(2점)이 5 로 맞는다
    expect([...r.skip].sort()).toEqual([itemKey(item(2, 3, 0)), itemKey(item(4, 2, 0))].sort())
  })

  it('예산을 정확히 채우는 경계(누적 = L)는 포함, 넘으면 제외', () => {
    expect(splitMust([item(1, 3, 0.9), item(2, 3, 0.8)], 94).skip.size).toBe(2) // L=6
    expect(splitMust([item(1, 3, 0.9), item(2, 3, 0.8)], 95).skip.size).toBe(1) // L=5
  })

  it('오답률 없는 문항은 항상 반드시이고 결측 수를 센다', () => {
    const r = splitMust(items, 60)
    expect(r.must.has(itemKey(item(5, 2, null)))).toBe(true)
    expect(r.missingRate).toBe(1)
  })

  it('오답률이 전부 결측이면 G<100 이어도 전부 반드시', () => {
    const r = splitMust([item(1, 2, null), item(2, 3, null)], 70)
    expect(r.skip.size).toBe(0)
    expect(r.missingRate).toBe(2)
  })

  it('TOP-N 만 관측된 자료: 관측 문항이 예산을 다 쓰면 과대 추정 아님, 예산이 남으면 과대 추정 가능', () => {
    // 상위 3문항(각 3점)만 오답률이 있고 나머지 문항은 미관측
    const top = [item(30, 3, 0.7), item(31, 3, 0.65), item(33, 3, 0.6)]
    const rest = [item(1, 2, null), item(2, 2, null), item(3, 3, null)]
    const all = [...top, ...rest]
    expect(splitMust(all, 91).mayOverstate).toBe(false) // L=9 → 3문항으로 정확히 소진, 남은 0
    expect(splitMust(all, 100).mayOverstate).toBe(false) // 예산 0
    expect(splitMust(all, 70).mayOverstate).toBe(true) // L=30 → 관측 9점만 쓰고 21점 남음 → 미관측이 더 들어갈 수 있다
  })

  it('남은 예산이 미관측 문항의 배점보다 작으면 과대 추정이 아니다', () => {
    const all = [item(30, 3, 0.7), item(31, 3, 0.6), item(1, 3, null)]
    expect(splitMust(all, 94).mayOverstate).toBe(false) // L=6 → 관측 6점 소진
    expect(splitMust([item(30, 3, 0.7), item(1, 3, null)], 96).mayOverstate).toBe(false) // L=4 → 3점 쓰고 1점 남지만 미관측 3점 문항은 안 들어간다
    expect(splitMust([item(30, 3, 0.7), item(1, 2, null)], 95).mayOverstate).toBe(true) // L=5 → 3점 쓰고 2점 남아 미관측 2점 문항이 들어갈 수 있다
  })

  it('같은 오답률은 번호 순(재실행해도 같은 결과)', () => {
    const r = splitMust([item(7, 2, 0.5), item(3, 2, 0.5)], 98) // L=2 → 3번만
    expect([...r.skip]).toEqual([itemKey(item(3, 2, 0))])
  })
})

describe('lineTarget', () => {
  it('목표율 = 반드시 배점 / 연결 배점', () => {
    const linked = [item(1, 2, 0.1), item(2, 3, 0.9)]
    const { must } = splitMust(linked, 97) // L=3 → 2번 skip
    const t = lineTarget(linked, must)
    expect(t.rate).toBeCloseTo(2 / 5)
    expect(t.mustItems.map((i) => i.no)).toEqual([1])
  })

  it('연결 문항이 없으면 null(분모 0) — 0% 가 아니다', () => {
    expect(lineTarget([], new Set()).rate).toBeNull()
  })
})

describe('lineStatus', () => {
  it('달성 · 근접 · 미달', () => {
    expect(lineStatus(0.8, 0.8, 0.9)).toBe('met')
    expect(lineStatus(0.73, 0.8, 0.9)).toBe('near')
    expect(lineStatus(0.5, 0.8, 0.9)).toBe('short')
  })
})

describe('aggregate', () => {
  it('목표 눈금은 전체 연결 라인으로 고정 — 진단 범위와 무관', () => {
    const kids = [
      { weight: 10, target: 1, achieved: 1 },
      { weight: 10, target: 0, achieved: null },
    ]
    expect(aggregate(kids, 0.9, 0.5).target).toBeCloseTo(0.5)
    expect(aggregate([{ ...kids[0] }, { ...kids[1], achieved: 0 }], 0.9, 0.5).target).toBeCloseTo(0.5)
  })

  it('일부만 진단된 라인이 높아도 달성을 확정하지 않는다(목표 100%·0% 두 라인 중 하나만 60%)', () => {
    const r = aggregate(
      [
        { weight: 10, target: 1, achieved: 0.6 },
        { weight: 10, target: 0, achieved: null },
      ],
      0.9,
      0.5,
    )
    expect(r.target).toBeCloseTo(0.5)
    expect(r.status).toBe('hold') // LB=0.3 < 0.5, UB=0.8 ≥ 0.45
  })

  it('미관측이 전부 틀려도 목표를 넘으면 달성', () => {
    const r = aggregate(
      [
        { weight: 10, target: 0.4, achieved: 1 },
        { weight: 10, target: 0.4, achieved: null },
      ],
      0.9,
      0.5,
    )
    expect(r.status).toBe('met') // LB = 0.5 ≥ 0.4
  })

  it('미관측이 전부 맞아도 미달이면 미달', () => {
    const r = aggregate(
      [
        { weight: 10, target: 1, achieved: 0.1 },
        { weight: 10, target: 1, achieved: null },
      ],
      0.9,
      0.5,
    )
    expect(r.status).toBe('short') // UB = 0.55 < 0.9
  })

  it('전부 진단됐으면 근접 판정이 가능하다', () => {
    const r = aggregate([{ weight: 10, target: 1, achieved: 0.95 }], 0.9, 0.5)
    expect(r.status).toBe('near')
    expect(r.coverage).toBe(1)
  })

  it('진단 범위가 min_coverage 미만이면 진단 필요', () => {
    const r = aggregate(
      [
        { weight: 10, target: 1, achieved: 1 },
        { weight: 30, target: 1, achieved: null },
      ],
      0.9,
      0.5,
    )
    expect(r.status).toBe('needs_diagnosis')
    expect(r.coverage).toBeCloseTo(0.25)
  })

  it('목표율이 null 인 라인(연결 문항 없음)은 집계에서 빠지고, 전부 null 이면 no_items', () => {
    const r = aggregate(
      [
        { weight: 0, target: null, achieved: null },
        { weight: 10, target: 0.5, achieved: 0.5 },
      ],
      0.9,
      0.5,
    )
    expect(r.target).toBeCloseTo(0.5)
    expect(aggregate([{ weight: 0, target: null, achieved: null }], 0.9, 0.5).status).toBe('no_items')
    expect(aggregate([], 0.9, 0.5).status).toBe('no_items')
  })
})

describe('selectReferenceExams', () => {
  const ex = (id: string, held: number, itemCount = 45, pointsTotal = 100): ExamCandidate => ({ id, label: id, held, itemCount, pointsTotal })

  it('정답표가 완전한 최근 N회만 고르고, 선정 범위 안의 자격 미달 회차를 알린다', () => {
    const r = selectReferenceExams([ex('A', 202509), ex('B', 202506, 0, 0), ex('C', 202411), ex('D', 202409)], 2)
    expect(r.exams.map((e) => e.id)).toEqual(['A', 'C'])
    expect(r.shortfall).toBe(0)
    expect(r.skipped.map((e) => e.id)).toEqual(['B'])
  })

  it('적격 시험이 N 보다 적으면 부족분을 알린다', () => {
    const r = selectReferenceExams([ex('A', 202509), ex('B', 202506, 45, 98)], 6)
    expect(r.exams.map((e) => e.id)).toEqual(['A'])
    expect(r.shortfall).toBe(5)
  })
})

describe('completionRate', () => {
  it('완료 / 전체, 과제가 없으면 null', () => {
    expect(completionRate(2, 3)).toBeCloseTo(2 / 3)
    expect(completionRate(0, 0)).toBeNull()
  })
})
