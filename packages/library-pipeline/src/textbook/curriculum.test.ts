// packages/library-pipeline/src/textbook/curriculum.test.ts
//
// **FK 는 낱말을 모른다.** 이 자가 그 구멍을 메운다.
//
// 실측으로 두 번 크게 틀렸던 자리다:
//   · NASA 사진 설명글 — FK 는 낮은데 내용어의 **64%가 교육과정 3,000 밖**이었다
//   · Project Gutenberg — Little Women(1868)·Tom Sawyer(1876)가 **FK 로는 초6~중1** 이다
//
// 어휘 가드를 붙이자 PG 조각의 **54~61%가 탈락**했다(실측 표본 5권).
// 즉 FK 만으로는 쓸 수 없는 것을 절반 넘게 통과시키고 있었다.

import { describe, expect, it } from 'vitest'

import {
  CURRICULUM_GATE,
  CURRICULUM_SPEC,
  curriculumCoverage,
  curriculumFit,
  curriculumLists,
  marketPercentile,
  passesCurriculumGate,
  stemLoose,
} from './curriculum'

/** 초등 별표(`*`) 낱말로만 쓴 글. */
const easy =
  'The girl walks to school every day. She meets her friend near the big tree. ' +
  'They talk about the new book. The sun is bright and the sky is blue.'

/** 학술 어휘 — 교육과정 3,000 밖이 많다. NASA 사진설명이 이 꼴이었다. */
const technical =
  'The photometric calibration reveals anomalous spectral signatures. ' +
  'Astronomers postulate that interstellar particulates attenuate the luminosity. ' +
  'Subsequent interferometric observations corroborate this hypothesis.'

describe('교육과정 어휘 목록', () => {
  it('세 등급을 읽는다 — 문서의 별표 표기 그대로', () => {
    const { star1, star2, plain } = curriculumLists()
    // 819 · 1,215 · 1,011 (CSV 머리말의 count). 낱말이 줄면 여기서 걸린다.
    expect(star1.size).toBeGreaterThan(800)
    expect(star2.size).toBeGreaterThan(1_200)
    expect(plain.size).toBeGreaterThan(1_000)
  })

  it('등급 순서가 난이도 순이다 — 표본 낱말이 그 해석을 뒷받침한다', () => {
    const { star1, plain } = curriculumLists()
    // `*` 는 a/about/above · 무표시는 abandon/aboard/abort.
    for (const w of ['a', 'about', 'above']) expect(star1.has(w), w).toBe(true)
    for (const w of ['abandon', 'aboard']) expect(plain.has(w), w).toBe(true)
    // 가장 쉬운 낱말이 가장 어려운 목록에 있으면 등급이 뒤집힌 것이다.
    expect(plain.has('about')).toBe(false)
  })

  it('굴절을 느슨하게 되돌린다 — 그래서 적중률은 하한이다', () => {
    expect(stemLoose('walks')).toBe('walk')
    expect(stemLoose('studies')).toBe('study')
    expect(stemLoose('walking')).toBe('walk')
    expect(stemLoose('walked')).toBe('walk')
    // `ss` 로 끝나는 낱말을 깎으면 안 된다.
    expect(stemLoose('class')).toBe('class')
  })
})

describe('어휘 적중률', () => {
  it('쉬운 글은 교육과정 밖이 적다', () => {
    const c = curriculumCoverage(easy)!
    expect(c.outsidePct).toBeLessThan(20)
    expect(c.star1Pct).toBeGreaterThan(50)
  })

  it('학술 어휘는 교육과정 밖이 많다 — NASA 사진설명이 이 꼴이었다(밖 64%)', () => {
    const c = curriculumCoverage(technical)!
    expect(c.outsidePct).toBeGreaterThan(50)
  })

  it('누적이 단조 증가한다 — `*` ≤ `*+**` ≤ 전체', () => {
    const c = curriculumCoverage(easy)!
    expect(c.star1Pct).toBeLessThanOrEqual(c.throughStar2Pct)
    expect(c.throughStar2Pct).toBeLessThanOrEqual(c.throughAllPct)
    expect(+(c.throughAllPct + c.outsidePct).toFixed(1)).toBe(100)
  })

  it('내용어가 없으면 null 이다 — 0% 를 돌려주지 않는다', () => {
    // 0% 는 "전부 교육과정 안" 으로 읽혀 잴 수 없는 글이 통과한다.
    expect(curriculumCoverage('')).toBeNull()
    expect(curriculumCoverage('the and of to a')).toBeNull()
  })
})

describe('어휘 가드', () => {
  it('쉬운 글은 통과한다', () => {
    expect(passesCurriculumGate(easy).pass).toBe(true)
  })

  it('학술 어휘는 막고 **이유를 숫자로 말한다**', () => {
    const r = passesCurriculumGate(technical)
    expect(r.pass).toBe(false)
    expect(r.reason).toMatch(/%/)
    expect(r.coverage).not.toBeNull()
  })

  it('못 재면 통과시키지 않는다 — 모름을 허용으로 바꾸지 않는다', () => {
    expect(passesCurriculumGate('').pass).toBe(false)
  })

  it('문턱이 시중 실측 p90 이다 — 짐작값 40 을 대체했다', () => {
    // 2026-09-04 실측: 시중 초·중 지문 196쪽. 문턱 40 은 그 분포의 p75 였다.
    expect(CURRICULUM_GATE.elementary.maxOutsidePct).toBe(CURRICULUM_SPEC.outside.elementary.p90)
    expect(CURRICULUM_GATE.middle.maxOutsidePct).toBe(CURRICULUM_SPEC.outside.middle.p90)
    // 옛 문턱보다 넓어야 한다 — 좁으면 시중 지문을 우리가 떨어뜨린다는 뜻이다.
    expect(CURRICULUM_GATE.elementary.maxOutsidePct).toBeGreaterThan(40)
    expect(CURRICULUM_GATE.middle.maxOutsidePct).toBeGreaterThan(40)
  })

  it('표본 수를 함께 들고 다닌다 — 얇은 표본을 두꺼운 척하지 않게', () => {
    expect(CURRICULUM_SPEC.outside.elementary.sample).toBeGreaterThan(100)
    expect(CURRICULUM_SPEC.outside.middle.sample).toBeGreaterThan(50)
    expect(CURRICULUM_SPEC.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('학교급마다 다른 자를 댄다', () => {
    // 중등 지문은 초등 자로 재면 더 자주 떨어진다 — 두 자가 실제로 다르다.
    expect(CURRICULUM_GATE.elementary.maxOutsidePct).not.toBe(CURRICULUM_GATE.middle.maxOutsidePct)
  })
})

describe('시중 분포에서의 자리 — 통과만으로는 부합이 아니다', () => {
  it('백분위가 단조 증가한다', () => {
    const p = [10, 20, 30, 40, 50, 60].map((x) => marketPercentile(x, 'middle'))
    for (let i = 1; i < p.length; i++) expect(p[i]!).toBeGreaterThan(p[i - 1]!)
  })

  it('시중 중앙값을 넣으면 50 이 나온다 — 자가 자기 눈금과 맞다', () => {
    expect(marketPercentile(CURRICULUM_SPEC.outside.middle.p50, 'middle')).toBeCloseTo(50, 0)
    expect(marketPercentile(CURRICULUM_SPEC.outside.elementary.p50, 'elementary')).toBeCloseTo(50, 0)
  })

  it('너무 쉬운 글은 낮은 백분위로 드러난다 — 막지는 않는다', () => {
    // StoryWeaver L1 이 이 꼴이었다(FK 1.42 · 초4 교재 1.81 보다도 아래).
    // 막으면 낮은 칸에 쓸 글까지 잃는다 — 그래서 게이트가 아니라 **자리**로 알린다.
    const f = curriculumFit(easy, 'elementary')
    expect(f.pass).toBe(true)
    expect(f.marketPercentile!).toBeLessThan(50)
  })

  it('시중 상한 밖은 95 를 넘는다', () => {
    expect(marketPercentile(60, 'middle')).toBeGreaterThan(95)
  })

  it('못 재면 자리도 null 이다 — 0 을 돌려주지 않는다', () => {
    expect(curriculumFit('').marketPercentile).toBeNull()
  })
})
