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

  it('모든 밴드가 실측 근거를 갖는다 — 근거 없는 임계로 막지 않는다', () => {
    // 네 밴드 모두 실측 근거를 갖는다. 근거 문자열이 비면 그때부터 임계는 짐작이다.
    expect(BAND_CONSTRAINT.elementary.calibrated).toBe(true) // VOA 30편으로 보정됨
    expect(BAND_CONSTRAINT.exam.calibrated).toBe(true) // 소스군 분리로 보정됨
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

  it('저레벨 콘텐츠도 주제어 때문에 밴드를 넘는다 — 초등 기준이 넉넉한 이유', () => {
    // VOA Learning English 30편(학습자용으로 일부러 쓴 글) 실측 V>3 = p50 27.3% · p90 33.2%.
    // 화산 기사에 volcano·lava 가 없을 수 없다. 그래서 초등 천장이 다른 밴드보다 훨씬 높다.
    expect(BAND_CONSTRAINT.elementary.value).toBeGreaterThan(BAND_CONSTRAINT.middle.value)
    expect(BAND_CONSTRAINT.middle.value).toBeGreaterThan(BAND_CONSTRAINT.high.value)

    // 쉬운 글 + 주제어 몇 개 → 초등 통과. 같은 글이 중등 밴드에서는 훨씬 여유롭다.
    const easyWithTopicWords = words([
      ['water', 1], ['river', 2], ['plant', 3], ['low', 1], ['stop', 1], ['day', 1],
      ['reactor', 8], ['coolant', 9],
    ])
    const el = profileBand(easyWithTopicWords, 'elementary')
    expect(el.aboveShare).toBeCloseTo(0.25) // 8개 중 2개
    expect(evaluateBand(el).verdict).toBe('PASS')

    // V5~6 수준의 글은 초등 천장을 넘는다 — 기준이 넉넉해도 판별력은 있다(실측 44.8~53.8%).
    const harder = words([
      ['water', 1], ['reactor', 8], ['coolant', 9], ['regime', 7], ['phenomenon', 7],
    ])
    expect(profileBand(harder, 'elementary').aboveShare).toBeGreaterThan(
      BAND_CONSTRAINT.elementary.value,
    )
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
