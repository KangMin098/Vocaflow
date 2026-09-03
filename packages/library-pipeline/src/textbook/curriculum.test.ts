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
  curriculumCoverage,
  curriculumLists,
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

  it('문턱이 40% 다 — 아직 실측값이 아니라 정한 값이라는 것을 잊지 않게', () => {
    // 시중 교재 지문으로 같은 값을 재면 이 수를 실측으로 바꿔야 한다.
    expect(CURRICULUM_GATE.maxOutsidePct).toBe(40)
  })
})
