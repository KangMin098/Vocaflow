// packages/library-pipeline/src/compose/spine.test.ts
//
// 스파인 축 계약 + 밴드 프로파일.

import { describe, expect, it } from 'vitest'

import {
  BAND_CONSTRAINT,
  GRADE_BANDS,
  SPINE_AXIS,
  bandForVRange,
  evaluateBand,
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

  it('보정 안 된 밴드는 판정하지 않는다 — 없는 근거로 막지 않는다', () => {
    // 초등: 초등용 지문이 코퍼스에 0편. 대입: V>11 초과가 구조적으로 0%.
    expect(BAND_CONSTRAINT.elementary.calibrated).toBe(false)
    expect(BAND_CONSTRAINT.exam.calibrated).toBe(false)
    expect(BAND_CONSTRAINT.middle.calibrated).toBe(true)
    expect(BAND_CONSTRAINT.high.calibrated).toBe(true)
    for (const c of Object.values(BAND_CONSTRAINT)) expect(c.basis.length).toBeGreaterThan(10)
  })

  it('최상위 밴드는 제약이 뒤집힌다 — 천장이 아니라 하한이다', () => {
    // V>11 초과는 축의 끝이라 언제나 0% 다. 천장으로 두면 아무것도 걸러내지 못한다.
    expect(BAND_CONSTRAINT.exam.kind).toBe('floor')
    expect(BAND_CONSTRAINT.middle.kind).toBe('ceiling')
    expect(BAND_CONSTRAINT.high.kind).toBe('ceiling')
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

describe('evaluateBand', () => {
  const words = (spec: Array<[string, number]>) => spec.map(([w, v]) => ({ word: w, v }))

  it('보정된 밴드는 기준으로 판정한다', () => {
    const easy = words([['river', 2], ['water', 1], ['plant', 3], ['reactor', 7]])
    expect(evaluateBand(profileBand(easy, 'high')).verdict).toBe('PASS')
  })

  it('보정된 밴드에서 초과가 크면 경고한다', () => {
    const hard = words([['river', 2], ['coolant', 9], ['repertoire', 10], ['nuance', 9]])
    const r = evaluateBand(profileBand(hard, 'high'))
    expect(r.verdict).toBe('WARN')
    expect(r.detail).toContain('밴드 초과')
  })

  it('보정 안 된 밴드는 통과도 실패도 아닌 UNCALIBRATED 로 남긴다', () => {
    const any = words([['river', 2], ['coolant', 9]])
    for (const band of ['elementary', 'exam'] as const) {
      const r = evaluateBand(profileBand(any, band))
      expect(r.verdict).toBe('UNCALIBRATED')
      expect(r.detail).toContain('기준이 없다')
    }
  })

  it('하한 밴드는 심화 어휘가 모자라면 걸린다 (천장 논리로 보면 절대 안 걸린다)', () => {
    // 보정되면 이렇게 동작해야 한다는 계약. 지금은 exam 이 미보정이라 직접 검사한다.
    const shallow = profileBand(words([['river', 2], ['water', 1], ['plant', 3]]), 'exam')
    expect(shallow.aboveShare).toBe(0) // 천장으로는 영원히 통과
    expect(shallow.deepShare).toBe(0) // 하한으로는 걸린다
    const deep = profileBand(words([['river', 2], ['coolant', 9], ['nuance', 10]]), 'exam')
    expect(deep.deepShare).toBeCloseTo(2 / 3)
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
