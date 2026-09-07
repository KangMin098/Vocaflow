// packages/library-pipeline/src/textbook/answer-bias-effect.test.ts
//
// 정답 쏠림 판정이 **표본 크기에 끌려가지 않는지** 지킨다.
//
// χ² 만 보면 n 이 클수록 사소한 차이가 "쏠림" 이 된다. 실제로 `insert` 52,523건의
// 최다 비중 23.4%(기대 20%)가 χ²=692.9 로 임계 9.5 를 73배 넘겨 최고 등급 경보를 냈다.
// 찍는 학습자의 이득은 3.4%p 뿐이었다 — 그런 경보가 쌓이면 진짜 쏠림을 못 본다.
import { describe, expect, it } from 'vitest'

import { assessAnswerBias } from './item-health'

describe('assessAnswerBias — 효과 크기', () => {
  it('표본이 크고 차이가 작으면 쏠림으로 세지 않는다', () => {
    // 실제 `insert` 재고 분포(2026-08-31).
    const b = assessAnswerBias([8659, 11128, 12294, 10467, 9975])
    expect(b.chi2).toBeGreaterThan(9.5) // 통계적으로는 유의하다
    expect(b.cramersV).toBeLessThan(0.1) // 그러나 크기가 없다
    expect(b.biased).toBe(false)
  })

  it('차이가 크면 표본이 작아도 쏠림으로 센다', () => {
    // 60문항 중 절반이 ③ — 찍으면 50% 를 맞는다.
    const b = assessAnswerBias([5, 5, 30, 10, 10])
    expect(b.cramersV).toBeGreaterThanOrEqual(0.1)
    expect(b.biased).toBe(true)
  })

  it('한 번호에 몰리면 V 가 1 에 가깝다', () => {
    const b = assessAnswerBias([0, 0, 100, 0, 0])
    expect(b.cramersV).toBeCloseTo(1, 5)
    expect(b.biased).toBe(true)
  })

  it('완전히 고르면 V 는 0 이다', () => {
    const b = assessAnswerBias([20, 20, 20, 20, 20])
    expect(b.chi2).toBe(0)
    expect(b.cramersV).toBe(0)
    expect(b.biased).toBe(false)
  })

  it('표본이 0 이어도 터지지 않는다', () => {
    const b = assessAnswerBias([0, 0, 0, 0, 0])
    expect(b.cramersV).toBe(0)
    expect(b.biased).toBe(false)
  })

  it('큰 표본이라도 차이가 크면 잡는다 — 크기가 기준이지 n 이 기준이 아니다', () => {
    const b = assessAnswerBias([2000, 2000, 12000, 2000, 2000])
    expect(b.cramersV).toBeGreaterThanOrEqual(0.1)
    expect(b.biased).toBe(true)
  })
})
