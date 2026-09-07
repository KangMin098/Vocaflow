// packages/library-pipeline/src/textbook/strip-section-labels.test.ts
//
// 절 이름 정제 회귀. **지우는 것보다 안 지우는 것을 더 많이 본다** — 이 규칙이 헛디디면
// 멀쩡한 문장의 첫 낱말이 사라지고, 그건 조판물에서 눈에 안 띈다.
import { describe, expect, it } from 'vitest'

import { stripSectionLabels } from './csat-format'

describe('stripSectionLabels — 홀로 선 절 이름', () => {
  it('글 머리에 붙은 절 이름을 뗀다', () => {
    expect(stripSectionLabels('Abstract The coexistence of diverse communities is a puzzle.'))
      .toBe('The coexistence of diverse communities is a puzzle.')
  })

  it('문장 끝 뒤에 붙은 것도 뗀다', () => {
    expect(stripSectionLabels('We ran the study. Methods We assessed risk factors.'))
      .toBe('We ran the study. We assessed risk factors.')
  })

  it('연달아 붙은 것을 다 뗀다', () => {
    expect(stripSectionLabels('Abstract Background The importance of sleep is clear.'))
      .toBe('The importance of sleep is clear.')
  })

  it('여러 낱말 라벨도 뗀다', () => {
    expect(stripSectionLabels('Materials and Methods Rabbits were fed ad libitum.'))
      .toBe('Rabbits were fed ad libitum.')
  })

  // ── 건드리면 안 되는 것 ────────────────────────────────────────────
  it('문장 안에 든 낱말은 그대로 둔다', () => {
    const s = 'She read the Introduction Section before the exam.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('뒤가 소문자면 그대로 둔다 — 진짜 문장이다', () => {
    const s = 'Results were mixed across the three sites.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('주어로 쓰인 절 이름을 지우지 않는다', () => {
    const s = 'The abstract was written last. Conclusions follow from the data.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('빈 값·null 을 견딘다', () => {
    expect(stripSectionLabels('')).toBe('')
    expect(stripSectionLabels(null as unknown as string)).toBe('')
  })

  it('절 이름이 없는 지문은 한 글자도 안 바꾼다', () => {
    const s = 'Small reductions to meat production in wealthier countries may help fight climate change.'
    expect(stripSectionLabels(s)).toBe(s)
  })
})
