// packages/library-pipeline/src/textbook/item-health.test.ts
//
// 문항 건강 점검 회귀. 지키려는 것은 **없는 것을 있다고 하지 않는 것** 이다.
// 관측이 0 이면 난이도·변별도는 계산되지 않아야 하고, 그 사실이 리포트에 남아야 한다.

import { describe, expect, it } from 'vitest'
import {
  assessAnswerBias,
  assessStock,
  CHI2_CRITICAL_05,
  difficulty,
  discrimination,
  type HealthInput,
} from './item-health'

const SPEC = { min: 90, max: 200 }

const item = (over: Partial<HealthInput> & { id: string }): HealthInput => ({
  type: 'order',
  answer: 1,
  choiceCount: 5,
  passageWords: 120,
  vLevel: 5,
  ...over,
})

describe('정답 번호 쏠림', () => {
  it('균등하면 쏠리지 않았다고 본다', () => {
    const b = assessAnswerBias([20, 20, 20, 20, 20])
    expect(b.chi2).toBe(0)
    expect(b.df).toBe(4)
    expect(b.biased).toBe(false)
    expect(b.maxShare).toBeCloseTo(0.2, 5)
  })

  it('한쪽으로 몰리면 잡는다', () => {
    const b = assessAnswerBias([60, 10, 10, 10, 10])
    expect(b.chi2).toBeGreaterThan(CHI2_CRITICAL_05[4]!)
    expect(b.biased).toBe(true)
  })

  it('**표본이 작으면 같은 비중이라도 쏠렸다고 하지 않는다** — 비중이 아니라 카이제곱으로 본다', () => {
    // 둘 다 최다 40% 다. 10문항에서는 우연으로 설명되고, 1,000문항에서는 안 된다.
    const few = assessAnswerBias([4, 2, 2, 1, 1])
    const many = assessAnswerBias([400, 200, 200, 100, 100])
    expect(few.maxShare).toBeCloseTo(many.maxShare, 5)
    expect(few.biased).toBe(false)
    expect(many.biased).toBe(true)
  })

  it('빈 입력에서 나누기 0 이 나지 않는다', () => {
    const b = assessAnswerBias([0, 0, 0, 0])
    expect(b.total).toBe(0)
    expect(b.maxShare).toBe(0)
    expect(b.biased).toBe(false)
  })

  it('임계값을 모르는 자유도는 판정하지 않는다 — 모르는 것을 괜찮다고 하지 않는다', () => {
    const b = assessAnswerBias(new Array(20).fill(1))
    expect(b.df).toBe(19)
    expect(CHI2_CRITICAL_05[19]).toBeUndefined()
    expect(b.biased).toBe(false)
  })
})

describe('난이도·변별도', () => {
  it('관측이 없으면 계산하지 않는다', () => {
    expect(difficulty({ id: 'x', attempts: 0, correct: 0 })).toBeNull()
    expect(discrimination({ id: 'x', attempts: 0, correct: 0 })).toBeNull()
  })

  it('난이도는 맞힌 비율이다', () => {
    expect(difficulty({ id: 'x', attempts: 10, correct: 4 })).toBeCloseTo(0.4, 5)
  })

  it('변별도는 상위−하위 정답률이다', () => {
    const d = discrimination({
      id: 'x',
      attempts: 20,
      correct: 12,
      upperCorrect: 9,
      upperCount: 10,
      lowerCorrect: 3,
      lowerCount: 10,
    })
    expect(d).toBeCloseTo(0.6, 5)
  })

  it('상·하위 집단이 없으면 변별도를 내지 않는다', () => {
    expect(discrimination({ id: 'x', attempts: 20, correct: 12 })).toBeNull()
  })
})

describe('재고 점검', () => {
  const stock: HealthInput[] = [
    ...Array.from({ length: 5 }, (_, i) => item({ id: `o${i}`, answer: (i % 5) + 1 })),
    item({ id: 'w1', type: 'word_order', choiceCount: 0, answer: 0, passageWords: null, vLevel: 3 }),
    item({ id: 'w2', type: 'word_order', choiceCount: 0, answer: 0, passageWords: null, vLevel: 3 }),
  ]

  it('유형별로 나눠 세고 밴드 분포를 낸다', () => {
    const h = assessStock(stock, SPEC)
    expect(h.total).toBe(7)
    const order = h.byType.find((t) => t.type === 'order')!
    expect(order.count).toBe(5)
    expect(order.byLevel).toEqual({ V5: 5 })
    const wo = h.byType.find((t) => t.type === 'word_order')!
    expect(wo.byLevel).toEqual({ V3: 2 })
  })

  it('답지가 없는 유형은 쏠림을 재지 않는다', () => {
    const wo = assessStock(stock, SPEC).byType.find((t) => t.type === 'word_order')!
    expect(wo.answerBias).toBeNull()
    expect(wo.outOfSpecPassage).toBeNull()
  })

  it('지문이 규격 밖인 문항을 센다', () => {
    const withLong = [...stock, item({ id: 'long', passageWords: 900 })]
    const order = assessStock(withLong, SPEC).byType.find((t) => t.type === 'order')!
    expect(order.outOfSpecPassage).toBe(1)
  })

  it('관측이 하나도 없으면 그 사실을 남긴다 — 평가 단계가 반쪽이라는 뜻', () => {
    const h = assessStock(stock, SPEC)
    expect(h.noObservations).toBe(true)
    for (const t of h.byType) {
      expect(t.observed).toBe(0)
      expect(t.degenerate).toBe(0)
    }
  })

  it('관측이 들어오면 변별이 정의상 0 인 문항을 잡는다', () => {
    const h = assessStock(stock, SPEC, [
      { id: 'o0', attempts: 30, correct: 30 }, // 모두 맞음 — 못 가른다
      { id: 'o1', attempts: 30, correct: 0 }, // 모두 틀림 — 못 가른다
      { id: 'o2', attempts: 30, correct: 15 },
    ])
    const order = h.byType.find((t) => t.type === 'order')!
    expect(h.noObservations).toBe(false)
    expect(order.observed).toBe(3)
    expect(order.degenerate).toBe(2)
  })

  it('빈 재고에서 터지지 않는다', () => {
    const h = assessStock([], SPEC)
    expect(h.total).toBe(0)
    expect(h.byType).toEqual([])
    expect(h.noObservations).toBe(true)
  })
})
