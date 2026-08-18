// packages/library-pipeline/src/compose/spine.test.ts
//
// 스파인 축 계약 + 밴드 프로파일.

import { describe, expect, it } from 'vitest'

import {
  BAND_TOLERANCE_DRAFT,
  GRADE_BANDS,
  SPINE_AXIS,
  bandForVRange,
  profileBand,
  type SpineWord,
} from './spine'

describe('스파인 축', () => {
  it('밴드 판정 정본은 v_level 이고 cefr_level 은 명시적으로 불신한다', () => {
    // 실측: 사전 cefr_level 은 CEFR-J 와 정확 일치 36.7% · 체계적 1단계 과대평가.
    // 커버리지가 넓다는 이유로 이걸 집는 실수가 반복돼서 계약으로 못 박는다.
    expect(SPINE_AXIS.primary).toBe('v_level')
    expect(SPINE_AXIS.distrusted).toBe('cefr_level')
    expect(SPINE_AXIS.primary).not.toBe(SPINE_AXIS.distrusted)
  })

  it('학령 밴드는 서로 겹친다 — 학령 사이에 읽을 수 없는 골이 없어야 한다', () => {
    const order = ['elementary', 'middle', 'high', 'exam'] as const
    for (let i = 0; i < order.length - 1; i++) {
      const a = GRADE_BANDS[order[i]!].vRange
      const b = GRADE_BANDS[order[i + 1]!].vRange
      expect(b.min).toBeLessThanOrEqual(a.max) // 겹치거나 맞닿는다
      expect(b.max).toBeGreaterThan(a.max) // 그러면서 위로 간다
    }
  })

  it('밴드가 올라갈수록 허용 초과 비율도 올라간다', () => {
    expect(BAND_TOLERANCE_DRAFT.elementary).toBeLessThan(BAND_TOLERANCE_DRAFT.middle)
    expect(BAND_TOLERANCE_DRAFT.middle).toBeLessThan(BAND_TOLERANCE_DRAFT.high)
    expect(BAND_TOLERANCE_DRAFT.high).toBeLessThan(BAND_TOLERANCE_DRAFT.exam)
  })
})

describe('profileBand', () => {
  const W = (word: string, v: number | null): SpineWord => ({ word, v })

  it('밴드를 넘는 단어 비율을 재고 누구인지 말한다', () => {
    const words = [W('river', 2), W('water', 1), W('reactor', 7), W('coolant', 9)]
    const p = profileBand(words, 'elementary') // max V3
    expect(p.known).toBe(4)
    expect(p.aboveBand).toBe(2)
    expect(p.aboveShare).toBeCloseTo(0.5)
    expect(p.offenders.map((o) => o.word)).toEqual(['coolant', 'reactor'])
  })

  it('사전에 없는 단어를 쉽다고 하지 않는다 — 분모에서 뺀다', () => {
    const p = profileBand([W('river', 2), W('zorblat', null)], 'elementary')
    expect(p.known).toBe(1)
    expect(p.unknown).toBe(1)
    expect(p.aboveShare).toBe(0)
  })

  it('같은 단어가 여러 번 나와도 한 번만 센다 (반복이 난이도를 낮추지 높이지 않는다)', () => {
    const p = profileBand([W('Reactor', 7), W('reactor', 7), W('river', 2)], 'elementary')
    expect(p.known).toBe(2)
    expect(p.aboveBand).toBe(1)
  })

  it('밴드가 높을수록 같은 글이 덜 걸린다', () => {
    const words = [W('river', 2), W('reactor', 7), W('coolant', 9)]
    expect(profileBand(words, 'elementary').aboveShare).toBeGreaterThan(
      profileBand(words, 'exam').aboveShare,
    )
    expect(profileBand(words, 'exam').aboveBand).toBe(0)
  })

  it('빈 입력에서 0으로 나누지 않는다', () => {
    const p = profileBand([], 'middle')
    expect(p.aboveShare).toBe(0)
    expect(p.offenders).toEqual([])
  })
})

describe('bandForVRange — 학습 유형과 학령을 잇는 지점', () => {
  it('실제 유형 vBand 가 뜻이 통하는 학령으로 간다', () => {
    expect(bandForVRange({ min: 1, max: 6 })).toBe('middle') // general_proficiency
    expect(bandForVRange({ min: 4, max: 8 })).toBe('high') // csat_korean
    expect(bandForVRange({ min: 7, max: 11 })).toBe('exam') // academic_english
    expect(bandForVRange({ min: 1, max: 3 })).toBe('elementary')
  })
})
