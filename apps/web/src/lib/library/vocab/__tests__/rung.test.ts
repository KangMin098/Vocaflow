// apps/web/src/lib/library/vocab/__tests__/rung.test.ts
//
// 발행물을 계단에 앉히는 규칙. **틀리는 방향이 안전한 쪽인지**를 함께 본다 —
// 계단을 위로 잘못 앉히면 학습자가 어려운 책을 자기 수준으로 착각한다.

import { describe, expect, it } from 'vitest'

import { measureLadderFill, rungForSet } from '../rung'

type S = Parameters<typeof rungForSet>[0] & { wordCount: number }
const set = (category: string, cefrLevel: string | null, wordCount = 100): S =>
  ({ category, cefrLevel, wordCount }) as S

describe('계단 배정 — 근거 순서', () => {
  it('컴포저가 정한 계단이 카테고리·CEFR 추정을 이긴다', () => {
    // 카테고리는 초등(1단 추정)인데 컴포저가 4단이라고 정해 두었다.
    const r = rungForSet({ ...set('elementary', 'A1'), ladderStep: 4 })
    expect(r.basis).toBe('authored')
    expect(r.rung?.step).toBe(4)
  })

  /*
    실측 2026-08-31 — 주제 단어장 13권이 낱말 중앙값 V8~V9(성인)인데 `cefr_level='A2'`
    라벨 때문에 3단(중학 1-2학년)에 앉고 있었다. 컴포저가 선언한 **목표** CEFR 은
    그 권이 실제로 무엇을 담았는지 말하지 않는다.
  */
  it('낱말 실측 중앙값이 카테고리·CEFR 라벨을 이긴다', () => {
    const r = rungForSet({ ...set('themed', 'A2'), level: { median: 6 } })
    expect(r.basis).toBe('measured')
    expect(r.rung?.step).toBe(6)
  })

  it('실측이 사다리 위면 계단을 비우고 멈춘다 — 라벨 추정으로 내려가지 않는다', () => {
    // A2 라벨만 보면 3단이지만, 낱말을 세면 성인 수준이다.
    const r = rungForSet({ ...set('themed', 'A2'), level: { median: 8 } })
    expect(r.basis).toBe('above-ladder')
    expect(r.rung).toBeNull()
  })

  it('학교급 카테고리여도 실측이 사다리 위면 앉히지 않는다', () => {
    const r = rungForSet({ ...set('elementary', 'A1'), level: { median: 9 } })
    expect(r.rung).toBeNull()
  })

  it('컴포저가 정한 계단은 실측보다도 세다 — 저작물이다', () => {
    const r = rungForSet({ ...set('themed', 'A2'), ladderStep: 2, level: { median: 9 } })
    expect(r.basis).toBe('authored')
    expect(r.rung?.step).toBe(2)
  })

  it('저작된 계단이 사다리 밖 값이면 추정으로 내려간다 — 없는 계단을 만들지 않는다', () => {
    const r = rungForSet({ ...set('csat', null), ladderStep: 99 })
    expect(r.basis).toBe('category')
    expect(r.rung?.step).toBe(7)
  })

  it('학교급을 말하는 카테고리가 CEFR 보다 세다', () => {
    // 카테고리는 초등인데 CEFR 은 B2(=V7 고3). 카테고리를 따른다.
    const r = rungForSet(set('elementary', 'B2'))
    expect(r.basis).toBe('category')
    expect(r.rung?.step).toBe(1)
  })

  it('학교급을 말하지 않는 칸이면 CEFR 로 앉힌다', () => {
    const r = rungForSet(set('themed', 'B1'))
    expect(r.basis).toBe('cefr')
    expect(r.rung?.step).toBe(5) // B1 → V5 → 고1
  })

  it('둘 다 없으면 앉히지 않는다 — 짐작으로 채우지 않는다', () => {
    const r = rungForSet(set('themed', null))
    expect(r.basis).toBe('none')
    expect(r.rung).toBeNull()
  })

  it('사다리 밖 CEFR(C1·C2 = 성인)은 앉히지 않는다', () => {
    expect(rungForSet(set('business', 'C1')).rung).toBeNull()
    expect(rungForSet(set('business', 'C2')).rung).toBeNull()
  })

  it('한 카테고리가 두 계단을 덮으면 아래 계단에 앉힌다', () => {
    // 중등 = 3단(중1-2) + 4단(중3). 위로 앉히면 어려운 책을 제 수준으로 착각한다.
    expect(rungForSet(set('middle', null)).rung?.step).toBe(3)
    expect(rungForSet(set('high', null)).rung?.step).toBe(5)
  })

  it('수능 칸은 최상단이다', () => {
    expect(rungForSet(set('csat', null)).rung?.step).toBe(7)
  })
})

describe('사다리 재고', () => {
  it('일곱 계단을 모두 낸다 — 빈 계단도 숨기지 않는다', () => {
    const fill = measureLadderFill([set('csat', null)])
    expect(fill.rungs).toHaveLength(7)
    expect(fill.emptySteps).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('권 수와 표제어를 계단별로 더한다', () => {
    const fill = measureLadderFill([
      set('elementary', null, 100),
      set('elementary', null, 250),
      set('csat', null, 900),
    ])
    const step1 = fill.rungs.find((r) => r.rung.step === 1)!
    expect(step1.volumes).toBe(2)
    expect(step1.words).toBe(350)
    expect(fill.rungs.find((r) => r.rung.step === 7)!.words).toBe(900)
  })

  it('앉히지 못한 권을 따로 센다 — 분모가 안 맞으면 사다리를 못 믿는다', () => {
    const fill = measureLadderFill([set('themed', null), set('csat', null)])
    expect(fill.unplaced).toBe(1)
    const placed = fill.rungs.reduce((s, r) => s + r.volumes, 0)
    expect(placed + fill.unplaced).toBe(2)
  })

  it('빈 목록이어도 계단이 사라지지 않는다', () => {
    const fill = measureLadderFill([])
    expect(fill.rungs).toHaveLength(7)
    expect(fill.unplaced).toBe(0)
  })
})
