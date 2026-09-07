// packages/library-pipeline/src/compose/adaptation.test.ts
//
// 적응 게이트 — 성립하는 검사만 남기고, 성립하지 않는 검사를 통과시킨 척하지 않는다.

import { describe, expect, it } from 'vitest'

import { isAdaptationPublishable, runAdaptationGates } from './adaptation'
import { withAttribution } from './attribution'
import { shelfRecordFrom } from './gates'
import type { SpineWord } from './spine'

const SOURCE_TEXT =
  'The spacecraft carried an instrument designed to measure the composition of the atmosphere. ' +
  'Engineers calibrated the detector for several months before launch. ' +
  'The mission is expected to return data for at least three years.'

const EASY = [
  'A spacecraft went into space. It carries a special tool.',
  'The tool measures the air around the planet. Engineers checked it many times first.',
  'The mission will send back data for three years.',
].join('\n\n')

const WORDS = (spec: Array<[string, number]>): SpineWord[] =>
  spec.map(([word, v]) => ({ word, v }))

const EASY_WORDS = WORDS([
  ['spacecraft', 3], ['space', 1], ['tool', 2], ['air', 1], ['planet', 3],
  ['engineer', 4], ['check', 1], ['mission', 4], ['data', 3], ['year', 1],
])

describe('적응 게이트', () => {
  it('critical 은 서가 중복 하나뿐 — 나머지는 라이선스가 이미 허락했다', () => {
    const r = runAdaptationGates({
      text: EASY,
      sourceText: SOURCE_TEXT,
      shelf: [],
      band: 'elementary',
      words: EASY_WORDS,
    })
    const criticals = r.filter((g) => g.severity === 'critical').map((g) => g.invariant)
    expect(criticals).toEqual(['I17 서가 중복'])
    // 재저작 전용 검사는 아예 돌지 않는다 — 통과시킨 척하면 검사한 척하는 것이다.
    const names = r.map((g) => g.invariant).join(' ')
    for (const skipped of ['I12', 'I13', 'I14', 'I15', 'I16']) {
      expect(names).not.toContain(skipped)
    }
    expect(isAdaptationPublishable(r)).toBe(true)
  })

  it('같은 원본의 다른 판과 겹치면 막는다', () => {
    const sibling = shelfRecordFrom({
      id: 'sib', title: 'sib', source: 'nasa', content: EASY,
    })
    const r = runAdaptationGates({
      text: EASY,
      sourceText: SOURCE_TEXT,
      shelf: [sibling],
      band: 'elementary',
      words: EASY_WORDS,
    })
    const dup = r.find((g) => g.invariant.startsWith('I17'))!
    expect(dup.verdict).toBe('FAIL')
    expect(isAdaptationPublishable(r)).toBe(false)
  })

  it('출처 표기가 겹쳐서 막히지 않는다', () => {
    const a = withAttribution(EASY, ['nasa.gov'])
    const sibling = shelfRecordFrom({
      id: 'sib', title: 'sib', source: 'nasa',
      content: withAttribution('A completely different easy text about oceans.', ['nasa.gov']),
    })
    const r = runAdaptationGates({
      text: a, sourceText: SOURCE_TEXT, shelf: [sibling], band: 'elementary', words: EASY_WORDS,
    })
    expect(r.find((g) => g.invariant.startsWith('I17'))!.verdict).toBe('PASS')
  })

  it('원문을 그대로 옮기면 경고하되 막지는 않는다 — 라이선스는 허락하지만 쉬운 판이 아니다', () => {
    const copied = SOURCE_TEXT
    const r = runAdaptationGates({
      text: copied, sourceText: SOURCE_TEXT, shelf: [], band: 'elementary', words: EASY_WORDS,
    })
    const a1 = r.find((g) => g.invariant.startsWith('A1'))!
    expect(a1.verdict).toBe('WARN')
    expect(a1.severity).toBe('warning')
    expect(isAdaptationPublishable(r)).toBe(true) // 막지 않는다
  })

  it('쉬워지지 않았으면 목표 레벨이 경고한다 — 적응의 존재 이유다', () => {
    const hard = WORDS([
      ['spacecraft', 3], ['instrument', 7], ['composition', 8], ['calibrate', 9],
      ['atmosphere', 7], ['detector', 8],
    ])
    const r = runAdaptationGates({
      text: EASY, sourceText: SOURCE_TEXT, shelf: [], band: 'elementary', words: hard,
    })
    expect(r.find((g) => g.invariant.startsWith('A2'))!.verdict).toBe('WARN')
  })
})
