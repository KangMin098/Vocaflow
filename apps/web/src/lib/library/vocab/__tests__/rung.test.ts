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
