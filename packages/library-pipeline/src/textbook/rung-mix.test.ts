// packages/library-pipeline/src/textbook/rung-mix.test.ts

import { describe, expect, it } from 'vitest'
import { largestRemainder } from './compose-unit'
import { ITEMS_PER_UNIT, rungMix, schoolOfBand, typeMixFit } from './rung-mix'

describe('schoolOfBand', () => {
  it('사다리 단수를 학교급으로 옮긴다', () => {
    expect(schoolOfBand(1)).toBe('초등')
    expect(schoolOfBand(2)).toBe('초등')
    expect(schoolOfBand(3)).toBe('중등')
    expect(schoolOfBand(4)).toBe('중등')
    expect(schoolOfBand(5)).toBe('고등')
    expect(schoolOfBand(7)).toBe('고등')
  })
})

describe('rungMix', () => {
  it('초등에는 순서·삽입을 넣지 않는다 — 시중 초등 교재 실측 0건', () => {
    const m = rungMix(1)
    expect(m.allowedTypes).not.toContain('order')
    expect(m.allowedTypes).not.toContain('insert')
    expect(m.targetShare.order).toBeUndefined()
  })

  it('초등의 최다 유형은 영작 배열이다 — 실측 36.7‰ 로 가장 흔하다', () => {
    const m = rungMix(2)
    const top = Object.entries(m.targetShare).sort((a, b) => b[1] - a[1])[0]
    expect(top?.[0]).toBe('word_order')
  })

  it('고등에서 순서·삽입 비중이 중등보다 크다', () => {
    const mid = rungMix(3)
    const high = rungMix(5)
    const share = (m: ReturnType<typeof rungMix>) =>
      (m.targetShare.order ?? 0) + (m.targetShare.insert ?? 0)
    expect(share(high)).toBeGreaterThan(share(mid))
  })

  it('비중의 합은 1 이다', () => {
    for (const band of [1, 2, 3, 4, 5, 6, 7]) {
      const sum = Object.values(rungMix(band).targetShare).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 6)
    }
  })

  it('재고에 없는 유형은 비중에서 빠진다 — 두면 그 몫이 빈칸으로 남는다', () => {
    const m = rungMix(5, ['order', 'insert'])
    expect(Object.keys(m.targetShare).sort()).toEqual(['insert', 'order'])
    expect(m.targetShare.order! + m.targetShare.insert!).toBeCloseTo(1, 6)
  })

  it('단원 크기를 지킨다', () => {
    for (const band of [1, 3, 5]) {
      const m = rungMix(band)
      expect(m.slots.order + m.slots.insert + m.extraPerUnit).toBe(ITEMS_PER_UNIT)
    }
  })
})

describe('largestRemainder', () => {
  it('합이 총량과 정확히 맞는다', () => {
    const q = largestRemainder({ a: 0.5, b: 0.3, c: 0.2 }, 10)
    expect(q.a! + q.b! + q.c!).toBe(10)
  })

  it('작은 비중을 0 으로 눌러 버리지 않는다 — 단순 반올림의 결함', () => {
    // 0.11 × 6 = 0.66 → 반올림하면 0. 최대잉여법은 몫을 남겨 준다.
    const q = largestRemainder({ big: 0.78, small: 0.11, tiny: 0.11 }, 6)
    expect(q.big).toBeGreaterThan(0)
    expect((q.small ?? 0) + (q.tiny ?? 0)).toBeGreaterThan(0)
  })

  it('같은 잉여면 이름 순 — 재실행해도 같은 결과여야 한다', () => {
    const a = largestRemainder({ x: 0.25, y: 0.25, z: 0.5 }, 5)
    const b = largestRemainder({ z: 0.5, y: 0.25, x: 0.25 }, 5)
    expect(a).toEqual(b)
  })

  it('총량이 0 이거나 비중이 비면 빈 몫을 준다', () => {
    expect(largestRemainder({ a: 1 }, 0)).toEqual({})
    expect(largestRemainder({}, 5)).toEqual({})
  })
})

describe('typeMixFit', () => {
  it('완전히 같으면 1', () => {
    expect(typeMixFit({ a: 5, b: 5 }, { a: 0.5, b: 0.5 })).toBe(1)
  })

  it('겹치는 유형이 없으면 0', () => {
    expect(typeMixFit({ a: 10 }, { b: 1 })).toBe(0)
  })

  it('시장에 없는 유형만 잔뜩이면 낮게 나온다 — 코사인이 못 잡는 자리', () => {
    // 실측 V3 의 상태: 시중 중등 교재에 거의 없는 순서·삽입이 67% 였다.
    const skewed = typeMixFit({ order: 40, insert: 40, topic: 3 }, { topic: 0.5, word_order: 0.5 })
    expect(skewed).toBeLessThan(0.1)
  })

  it('빈 권은 0', () => {
    expect(typeMixFit({}, { a: 1 })).toBe(0)
  })
})

describe('유형을 새로 열면 적합도가 먼저 떨어진다 — 2026-08-30 실측 재현', () => {
  // V7 재고에 실제로 있던 일곱 유형. `topic` 은 0건이었다.
  const HAVE7 = ['grammar_choice', 'vocab_choice', 'order', 'word_order', 'blank_word', 'grammar_fix', 'insert']
  const HAVE8 = [...HAVE7, 'topic']

  /** 120문항 한 권. 실제 조판이 낸 구성을 그대로 옮겼다. */
  const BEFORE = { grammar_choice: 35, vocab_choice: 30, order: 14, word_order: 14, blank_word: 10, grammar_fix: 9, insert: 8 }
  const TOPIC_10 = { grammar_choice: 30, vocab_choice: 26, order: 14, word_order: 13, topic: 10, blank_word: 10, grammar_fix: 9, insert: 8 }
  const TOPIC_20 = { grammar_choice: 28, vocab_choice: 24, topic: 20, order: 14, word_order: 11, insert: 8, blank_word: 8, grammar_fix: 7 }

  it('없던 유형을 열자 목표 비중이 그 유형에 새로 배정된다', () => {
    const before = rungMix(7, HAVE7).targetShare
    const after = rungMix(7, HAVE8).targetShare
    expect(before.topic).toBeUndefined()
    expect(after.topic).toBeGreaterThan(0.15) // 여덟으로 나뉘며 단번에 큰 몫을 갖는다
    // 나머지 유형의 목표는 그만큼 낮아진다 — 합이 1 이기 때문이다.
    expect(after.grammar_choice).toBeLessThan(before.grammar_choice!)
  })

  it('조금만 넣으면 오히려 내려간다 — 한 청크만 보고 "효과 없음" 으로 읽으면 안 된다', () => {
    const fitBefore = typeMixFit(BEFORE, rungMix(7, HAVE7).targetShare)
    const fit10 = typeMixFit(TOPIC_10, rungMix(7, HAVE8).targetShare)
    const fit20 = typeMixFit(TOPIC_20, rungMix(7, HAVE8).targetShare)

    expect(fit10).toBeLessThan(fitBefore)   // 69.4% → 68.8%
    expect(fit20).toBeGreaterThan(fitBefore) // → 77.1%
    expect(fit20).toBeGreaterThan(fit10)
  })
})
