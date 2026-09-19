// apps/web/src/lib/learner/__tests__/memory-lift.test.ts
import { describe, expect, it } from 'vitest'

import { baseCurve, buildMemoryLift, planCurve, type LiftCardInput } from '../memory-lift'

const NOW = new Date('2026-09-19T00:00:00Z')
const DAY = 86_400_000

function card(id: string, over: Partial<LiftCardInput> = {}): LiftCardInput {
  return {
    id,
    word: id,
    difficulty: 0,
    stability: 0,
    lastReviewAt: null,
    nextReviewAt: null,
    moduleHistory: [],
    reviewCount: 0,
    ...over,
  }
}

/** 실측 계정의 모양 — 오래전에 흐려진 카드(S 작음, 마지막 복습 60일 전) */
function faded(id: string): LiftCardInput {
  return card(id, {
    difficulty: 6,
    stability: 1.5,
    lastReviewAt: new Date(NOW.getTime() - 60 * DAY),
    nextReviewAt: new Date(NOW.getTime() - 58 * DAY),
    reviewCount: 3,
  })
}

const strictlyFalling = (vs: number[]) => vs.every((v, d) => d === 0 || v < vs[d - 1])

describe('buildMemoryLift', () => {
  it('새 낱말만 있는 학습자(검증 계정 모양) — 그대로 두면 0, 오늘 익히면 내려가는 곡선이 선다', () => {
    const lift = buildMemoryLift(['a', 'b', 'c'].map((id) => card(id)), NOW)

    expect(lift.words.map((w) => w.state)).toEqual(['new', 'new', 'new'])
    expect(baseCurve(lift)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])

    const plan = planCurve(lift, 3)
    expect(plan[0]).toBeCloseTo(3, 5)
    // 2026-09-19 첫 캡처의 결함(직사각형) 회귀 — 기억은 가만히 두면 날마다 내려간다
    expect(strictlyFalling(plan)).toBe(true)
    expect(plan[7]).toBeGreaterThan(0)
  })

  it('전부 흐려진 학습자(실제 계정 모양) — 기준선은 바닥 근처, 다시 보면 들어 올려진다', () => {
    const lift = buildMemoryLift(Array.from({ length: 5 }, (_, i) => faded(`f${i}`)), NOW)
    expect(lift.words.every((w) => w.state === 'risk')).toBe(true)

    const base = baseCurve(lift)
    const plan = planCurve(lift, 5)
    expect(base[0]).toBeLessThan(0.5)
    expect(plan[0]).toBeCloseTo(5, 5)
    for (let d = 0; d < plan.length; d++) expect(plan[d]).toBeGreaterThan(base[d])
  })

  it('planCurve(0) 은 기준선 그대로, N 은 낱말 수로 잘린다', () => {
    const lift = buildMemoryLift([card('a'), faded('b')], NOW)
    expect(planCurve(lift, 0)).toEqual(baseCurve(lift))
    expect(planCurve(lift, 99)).toEqual(planCurve(lift, 2))
    expect(planCurve(lift, -3)).toEqual(baseCurve(lift))
  })

  it('앞에서부터 고른다 — 세션 큐 순서와 같은 N개', () => {
    const lift = buildMemoryLift([faded('x'), card('y')], NOW)
    const one = planCurve(lift, 1)
    const base = baseCurve(lift)
    // 첫 낱말(x)만 더해졌다: 오늘 값이 x 의 after[0]-before[0] 만큼 오른다
    expect(one[0] - base[0]).toBeCloseTo(lift.words[0].after[0] - lift.words[0].before[0], 5)
  })

  it('지평을 바꾸면 길이가 따라온다', () => {
    const lift = buildMemoryLift([card('a')], NOW, 3)
    expect(lift.words[0].after).toHaveLength(4)
    expect(baseCurve(lift)).toHaveLength(4)
  })
})
