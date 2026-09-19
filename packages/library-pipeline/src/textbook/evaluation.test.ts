// packages/library-pipeline/src/textbook/evaluation.test.ts
//
// 평가 요소 대조표 회귀. 지키려는 것은 **근거 없이 우위라고 적지 않는 것** 이다.

import { describe, expect, it } from 'vitest'
import { CATEGORY_KO, EVAL_DIMENSIONS, measureEvaluation } from './evaluation'

describe('EVAL_DIMENSIONS', () => {
  it('4대 대범주를 모두 덮는다 — 한 범주가 비면 대조가 반쪽이다', () => {
    const cats = new Set(EVAL_DIMENSIONS.map((d) => d.category))
    expect([...cats].sort()).toEqual(['curriculum', 'legal', 'pedagogy', 'physical'])
    for (const c of cats) expect(CATEGORY_KO[c].length).toBeGreaterThan(0)
  })

  it('키가 겹치지 않는다 — 겹치면 분모가 부풀려진다', () => {
    const keys = EVAL_DIMENSIONS.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('**모든 요소가 시중 기준과 우리 상태를 함께 적는다** — 한쪽만 적으면 비교가 아니다', () => {
    for (const d of EVAL_DIMENSIONS) {
      expect(d.market.length, d.key).toBeGreaterThan(20)
      expect(d.ours.length, d.key).toBeGreaterThan(20)
    }
  })

  it('**우위라고 적은 것은 반드시 어떻게 쟀는지 적는다**', () => {
    for (const d of EVAL_DIMENSIONS.filter((x) => x.standing === 'superior')) {
      expect(d.howMeasured, d.key).toMatch(/실측|측정|검정|대조/)
    }
  })

  it('못 잰 것은 우위로도 열위로도 적지 않는다', () => {
    for (const d of EVAL_DIMENSIONS.filter((x) => x.standing === 'unmeasured')) {
      expect(d.howMeasured, d.key).toMatch(/못|아직|검증/)
    }
  })

  it('없는 것은 대응물을 자랑하지 않는다', () => {
    for (const d of EVAL_DIMENSIONS.filter((x) => x.standing === 'absent')) {
      expect(d.ours, d.key).toMatch(/없다|못 한다|못한다/)
    }
  })
})

describe('measureEvaluation', () => {
  it('분모는 요소 전체다 — 못 잰 것을 빼지 않는다', () => {
    const r = measureEvaluation()
    const sum = Object.values(r.byStanding).reduce((s, n) => s + n, 0)
    expect(sum).toBe(r.total)
    expect(r.superiorRatio).toBeCloseTo(r.byStanding.superior / r.total, 5)
  })

  it('지고 있는 요소를 따로 낸다 — 다음에 할 일이다', () => {
    const r = measureEvaluation()
    expect(r.losing.length).toBe(r.byStanding.inferior + r.byStanding.absent)
    // 지금 크게 지는 것은 반드시 목록에 있어야 한다.
    expect(r.losing.map((d) => d.key)).toContain('type_coverage')
    // 관측이 0행인 한 난이도·변별도는 계속 열위다 — 학습 기록이 쌓여야 풀린다.
    expect(r.losing.map((d) => d.key)).toContain('difficulty_data')
    // ⚠️ `explanation` 은 2026-08-21 에 열위에서 빠졌다 — 발행 대상 다섯 권이 모두 80/80
    //   이 됐기 때문이다(결정론 6.9% + Claude Code 배치). **재고 전체가 아니라 발행 대상
    //   기준**이라 다시 나빠질 수 있다: 집필로 재고가 늘면 권 조합이 바뀌어 구멍이 다시 생긴다.
    //   실제로 그 일이 두 번 있었다. 그래서 `parity` 이지 `superior` 가 아니다.
    expect(r.losing.map((d) => d.key)).not.toContain('explanation')
  })

  it('범주별 집계가 총계와 맞는다', () => {
    const r = measureEvaluation()
    const sum = Object.values(r.byCategory).reduce((s, c) => s + c.total, 0)
    expect(sum).toBe(r.total)
  })

  it('빈 목록에서 나누기 0 이 나지 않는다', () => {
    expect(measureEvaluation([]).superiorRatio).toBe(0)
  })
})
