// packages/library-pipeline/src/textbook/series.test.ts
//
// 시리즈 사다리 회귀. 지키려는 것은 **계단이 학령 사다리와 어긋나지 않는 것** 이다.
// 눈금이 둘이면 반드시 갈린다 — 이 저장소가 이미 여러 번 겪은 사고다.

import { describe, expect, it } from 'vitest'
import { SERIES_BRAND, SERIES_SPINE, measureSeriesFill, type Inventory } from './series'
import { SCHOOL_TYPES } from './school-types'

describe('SERIES_SPINE', () => {
  it('계단 번호가 1부터 빠짐없이 이어진다', () => {
    expect(SERIES_SPINE.map((r) => r.step)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('레벨이 겹치지도 건너뛰지도 않는다 — 겹치면 같은 학년이 두 권을 산다', () => {
    const levels = SERIES_SPINE.flatMap((r) => r.vLevels)
    expect(new Set(levels).size).toBe(levels.length)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
    // 학령 사다리(V1~V7)를 통째로 덮는다. V0(유치원)·V8+(성인)은 읽기 교재 밖이다.
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('모든 계단이 이름과 근거를 갖는다', () => {
    for (const r of SERIES_SPINE) {
      expect(r.volumeTitle.startsWith(SERIES_BRAND), r.volumeTitle).toBe(true)
      expect(r.schoolBand.length, `${r.step}단`).toBeGreaterThan(0)
      expect(r.rationale.length, `${r.step}단`).toBeGreaterThan(20)
      expect(r.types.length, `${r.step}단`).toBeGreaterThan(0)
    }
  })

  it('**초등 계단에는 순서·삽입이 없다** — 그 유형은 수능 지문 길이를 전제한다', () => {
    // `school-types.ts` 가 밝힌 사실이다. 초중급 재고가 0으로 보이던 오진의 원인이었다.
    for (const r of SERIES_SPINE.filter((x) => x.schoolBand.startsWith('초등'))) {
      expect(r.types, `${r.step}단`).not.toContain('order')
      expect(r.types, `${r.step}단`).not.toContain('insert')
    }
  })

  it('**고등 계단에는 파닉스가 없다** — 계단이 다르면 유형도 다르다', () => {
    for (const r of SERIES_SPINE.filter((x) => x.vLevels.some((v) => v >= 5))) {
      expect(r.types, `${r.step}단`).not.toContain('rhyme')
      expect(r.types, `${r.step}단`).not.toContain('spell_blank')
    }
  })

  it('유형 구성이 단조롭게 넓어진다 — 위 계단이 아래보다 좁아지면 사다리가 아니다', () => {
    // 초등 3종은 위로 갈수록 빠지므로 **지문 기반 유형**만 본다.
    const passageTypes = ['word_order', 'vocab_choice', 'grammar_choice', 'order', 'insert', 'irrelevant']
    const counts = SERIES_SPINE.map((r) => r.types.filter((t) => passageTypes.includes(t)).length)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!, `${i + 1}단`).toBeGreaterThanOrEqual(counts[i - 1]! - 1)
    }
  })

  it('초등이 쓰는 유형은 school-types 의 초등 유형과 어긋나지 않는다', () => {
    const elementaryKeys = new Set(
      SCHOOL_TYPES.filter((t) => t.band === 'elementary').map((t) => t.key),
    )
    // `rhyme`·`spell_blank` 는 `phonics`·`spell_blank` 로 대응한다.
    expect(elementaryKeys.has('phonics')).toBe(true)
    expect(elementaryKeys.has('spell_blank')).toBe(true)
    expect(elementaryKeys.has('basic_vocab')).toBe(true)
  })
})

describe('measureSeriesFill', () => {
  const inv: Inventory = [
    { type: 'rhyme', vLevel: 1, count: 400 },
    { type: 'word_meaning', vLevel: 1, count: 800 },
    { type: 'spell_blank', vLevel: 1, count: 500 },
    { type: 'order', vLevel: 5, count: 200 },
    { type: 'insert', vLevel: 5, count: 300 },
    // 다른 계단의 것 — 섞이면 안 된다.
    { type: 'order', vLevel: 9, count: 999 },
  ]

  it('계단이 자기 레벨의 자기 유형만 센다', () => {
    const fill = measureSeriesFill(inv)
    const first = fill.rungs[0]!
    expect(first.total).toBe(1700)
    const grade1 = fill.rungs.find((r) => r.rung.step === 5)!
    expect(grade1.byType.order).toBe(200) // V9 의 999 는 안 섞인다
    expect(grade1.byType.insert).toBe(300)
  })

  it('쓰기로 한 유형 중 재고가 0인 것을 따로 낸다 — 반쪽인 책을 숨기지 않는다', () => {
    const grade1 = measureSeriesFill(inv).rungs.find((r) => r.rung.step === 5)!
    expect(grade1.emptyTypes).toContain('vocab_choice')
    expect(grade1.emptyTypes).toContain('grammar_choice')
  })

  it('**문항이 하나도 없는 계단을 끊긴 자리로 낸다**', () => {
    const fill = measureSeriesFill(inv)
    // 2·3·4·6·7단에는 재고를 안 넣었다.
    expect(fill.brokenSteps).toEqual([2, 3, 4, 6, 7])
  })

  it('빈 재고에서도 터지지 않고, 모든 계단이 끊긴 것으로 나온다', () => {
    const fill = measureSeriesFill([])
    expect(fill.brokenSteps).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(fill.rungs.every((r) => r.total === 0)).toBe(true)
  })
})
