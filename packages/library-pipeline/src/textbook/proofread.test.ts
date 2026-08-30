// packages/library-pipeline/src/textbook/proofread.test.ts
//
// 표본은 **DB 에 실제로 들어 있는 지문**을 그대로 옮겼다(2026-08-30 실측).
// 지어낸 문장으로 통과시키면 저장 지문에 돌렸을 때 아무것도 못 잡거나 전부 잡는다.

import { describe, expect, it } from 'vitest'
import { proofreadPassage, summarizeProofread } from './proofread'

const rules = (ss: string[]): string[] => proofreadPassage(ss).map((f) => f.rule)

describe('재교 — 한 자리만 보면 아는 것', () => {
  it('기호가 제거되며 생긴 구멍을 잡는다', () => {
    // 실측: 수식 기호가 빠져 "to any , which" 가 되었다.
    const found = proofreadPassage([
      'These contain k symmetric atoms within a predefined proximity to any , which are selected as .',
    ])
    expect(found.map((f) => f.rule)).toContain('space_before_punct')
  })

  it('말줄임표를 결함으로 잡지 않는다 — 실측 오탐이었다', () => {
    const found = proofreadPassage([
      'He kept talking about her music, saying, "I can\'t separate my music from my opinions ... it\'s a whole that reflects my way of living."',
    ])
    expect(found.map((f) => f.rule)).not.toContain('space_before_punct')
  })

  it('연속 공백과 반복 낱말을 잡는다', () => {
    expect(rules(['The  study found a clear result.'])).toContain('double_space')
    expect(rules(['The study found a a clear result.'])).toContain('repeated_word')
  })

  it('겹친 고유명사는 단정하지 않고 확인을 청한다', () => {
    // 실측: `Durand Durand` 는 Barbarella 악당의 실제 이름이라 중복이 아니다.
    const f = proofreadPassage(['They sent the president to retrieve Durand Durand from Tau Ceti.'])
      .find((x) => x.rule === 'repeated_word')
    expect(f).toBeDefined()
    expect(f!.hint).toContain('확인한다')
    const dup = proofreadPassage(['They suggested those those considered bad stock.'])
      .find((x) => x.rule === 'repeated_word')
    expect(dup!.hint).toContain('하나를 지운다')
  })

  it('정상적으로 겹치는 낱말은 잡지 않는다', () => {
    expect(rules(['She had had enough of the noise.'])).not.toContain('repeated_word')
    expect(rules(['The claim that that model is wrong stands.'])).not.toContain('repeated_word')
  })

  it('괄호 짝이 안 맞으면 잡는다', () => {
    expect(rules(['The result (see Table 2 was unexpected.'])).toContain('unbalanced_paren')
    expect(rules(['The result (see Table 2) was unexpected.'])).not.toContain('unbalanced_paren')
  })

  it('문장 분리기가 괄호 안에서 끊어도 오탐이 아니다 — 실측 오탐이었다', () => {
    // `e.g.` 의 마침표에서 문장이 갈렸다. 문장마다 세면 두 조각 모두 짝이 안 맞는다.
    expect(rules(['Some bacteria (e.g.', 'Bacillus) survive extreme heat.']))
      .not.toContain('unbalanced_paren')
  })
})

describe('삼교 — 글 전체를 봐야 아는 것', () => {
  it('아포스트로피와 큰따옴표를 따로 본다', () => {
    // 굽은 아포스트로피 + 곧은 큰따옴표 — 실측에서 가장 흔한 모양이다.
    const mixedKinds = proofreadPassage(['We’ve seen it.', 'He said "yes" to us.'])
    expect(mixedKinds.map((f) => f.rule)).not.toContain('apostrophe_style')
    // 같은 종류끼리 섞인 자리만 잡는다.
    const mixedApos = proofreadPassage(['We’ve seen it.', "It's clear now."])
    expect(mixedApos.map((f) => f.rule)).toContain('apostrophe_style')
    const mixedQuote = proofreadPassage(['He said “yes” to us.', 'She said "no" to us.'])
    expect(mixedQuote.map((f) => f.rule)).toContain('quote_style')
  })

  it('-ise/-ize 혼용을 잡는다', () => {
    expect(rules(['They organise the data.', 'We recognize the pattern.'])).toContain('ise_ize')
  })

  it('-ise 로 끝나는 보통 낱말을 혼용으로 오인하지 않는다', () => {
    // wise · exercise · precise 는 변이형이 아니다 — 어간 목록이 없으면 전부 오탐이 된다.
    expect(rules(['A wise choice.', 'We recognize the exercise as precise.'])).not.toContain('ise_ize')
    expect(rules(['The prize was a surprise.', 'They organise it.'])).not.toContain('ise_ize')
  })

  it('대시 혼용을 잡는다', () => {
    expect(rules(['The rate — the average — will rebound.', 'It fell - sharply - last year.']))
      .toContain('dash_style')
  })

  it('한 문장만 보면 알 수 없는 것이므로 문장을 합쳐서 본다', () => {
    // 각 문장은 따로 보면 흠이 없다. 섞였다는 사실이 결함이다.
    expect(proofreadPassage(['They organise the data.'])).toHaveLength(0)
    expect(proofreadPassage(['We recognize the pattern.'])).toHaveLength(0)
  })
})

describe('깨끗한 지문', () => {
  it('실측 정상 지문에서 아무것도 잡지 않는다', () => {
    const clean = [
      'Astronomers use the term active galaxy to describe galaxies with unusual characteristics.',
      'These galaxies emit far more energy than the stars within them can account for.',
      'The source of that energy is thought to be a supermassive black hole at the centre.',
    ]
    expect(proofreadPassage(clean)).toHaveLength(0)
  })

  it('빈 입력은 빈 결과', () => {
    expect(proofreadPassage([])).toHaveLength(0)
    expect(proofreadPassage([''])).toHaveLength(0)
  })
})

describe('summarizeProofread', () => {
  it('결함 지문 비율과 규칙별 건수를 센다', () => {
    const s = summarizeProofread([
      ['The  study found it.'],
      ['A clean sentence stands here without any defect at all.'],
      ['They organise it.', 'We recognize it.'],
    ])
    expect(s.passages).toBe(3)
    expect(s.defective).toBe(2)
    expect(s.defectRate).toBeCloseTo(2 / 3, 5)
    expect(s.byRule.double_space).toBe(1)
    expect(s.byRule.ise_ize).toBe(1)
  })
})
