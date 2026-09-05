// packages/library-pipeline/src/textbook/curriculum-words.test.ts
//
// **낱말 단위 분류와 비율 계산이 한 자인가.** `curriculumCoverage` 는 `classifyCurriculumWords`
// 위에서 세기만 하므로 둘이 갈리면 리팩터가 뜻을 바꾼 것이다.

import { describe, expect, it } from 'vitest'

import { classifyCurriculumWords, curriculumCoverage, curriculumOutsideWords } from './curriculum'

const text =
  'Ocean currents carry warm and cold water around the planet. ' +
  'The Gulf Stream, a river of warm salt water, flows across the Atlantic. ' +
  'Where warm currents occur, the climate is mild; where cold currents dominate, it is harsh.'

describe('낱말 단위 분류 = 비율 계산의 분자·분모', () => {
  it('내용어 수가 같다 — 토큰화가 한 벌이다', () => {
    const cov = curriculumCoverage(text)!
    expect(classifyCurriculumWords(text).length).toBe(cov.contentWords)
  })

  it('밖 낱말 수 / 내용어 수 가 outsidePct 와 같다', () => {
    const cov = curriculumCoverage(text)!
    const words = classifyCurriculumWords(text)
    const outside = words.filter((w) => w.tier === 'outside').length
    expect(+((outside / words.length) * 100).toFixed(1)).toBe(cov.outsidePct)
  })

  it('누적 등급이 예전 루프와 같은 뜻이다 — star1 ⊂ star2 ⊂ all', () => {
    const cov = curriculumCoverage(text)!
    expect(cov.star1Pct).toBeLessThanOrEqual(cov.throughStar2Pct)
    expect(cov.throughStar2Pct).toBeLessThanOrEqual(cov.throughAllPct)
    expect(+(cov.throughAllPct + cov.outsidePct).toFixed(1)).toBeCloseTo(100, 0)
  })

  it('밖 목록은 빈도 내림차순이고 합이 밖 낱말 수와 같다', () => {
    const list = curriculumOutsideWords(text)
    const total = classifyCurriculumWords(text).filter((w) => w.tier === 'outside').length
    expect(list.reduce((a, x) => a + x.n, 0)).toBe(total)
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.n).toBeGreaterThanOrEqual(list[i]!.n)
  })

  it('기능어는 어느 등급에도 안 들어간다 — 분모에서 빠져야 소스가 구별된다', () => {
    expect(classifyCurriculumWords('the and of to in a is are')).toEqual([])
    expect(curriculumCoverage('the and of')).toBeNull()
  })
})
