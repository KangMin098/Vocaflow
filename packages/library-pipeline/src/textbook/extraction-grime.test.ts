// packages/library-pipeline/src/textbook/extraction-grime.test.ts
//
// **원문 추출 잡티는 내용 오류가 아니라 조판 사고로 읽힌다.**
//
// 교정기를 배선하고 나서야 7권에서 실 결함 6건이 처음 보였다(2026-08-31). 여섯 건 모두
// 내용이 틀린 게 아니라 PDF·위키·사이트 머리글에서 딸려 온 잡티였다 — 그런데 시중 교재에는
// 없는 모양이라, 학습자에게는 "대충 만든 책" 으로 읽힌다.
//
// 여기서 지키는 원칙: **모르면 안 고친다.** 짝을 알 수 없는 따옴표, 문장 가운데의 겹친
// 낱말은 손대지 않는다. 고칠 수 있는 자리만 좁게 고친다.
import { describe, expect, it } from 'vitest'

import {
  dropDuplicatedLeadWord,
  pairStraightQuotes,
  stripSpaceBeforePunct,
} from './csat-format'
import { proofreadPassage } from './proofread'

const rules = (s: string) => proofreadPassage([s]).map((f) => f.rule)

describe('구두점 앞 공백', () => {
  it('실측 4건을 고친다', () => {
    // V6 `vocab_choice` 두 지문에서 나온 실제 모양이다.
    expect(stripSpaceBeforePunct('susceptible soybean cultivars .')).toBe(
      'susceptible soybean cultivars.',
    )
    expect(stripSpaceBeforePunct('genotype/phenotype mapping , using the map')).toBe(
      'genotype/phenotype mapping, using the map',
    )
    expect(stripSpaceBeforePunct('introduced by Lindenmayer , , to demonstrate')).toBe(
      'introduced by Lindenmayer, to demonstrate',
    )
  })

  it('말줄임표는 건드리지 않는다', () => {
    // 교정 규칙 자체가 `..`·`…` 를 건너뛴다. 정규화도 같은 자리를 비켜야 앞뒤가 맞는다.
    const ellipsis = 'my opinions ... it’s a whole'
    expect(stripSpaceBeforePunct(ellipsis)).toBe(ellipsis)
    expect(stripSpaceBeforePunct('she paused … and left.')).toBe('she paused … and left.')
  })

  it('고친 결과가 교정을 통과한다', () => {
    expect(rules(stripSpaceBeforePunct('susceptible soybean cultivars .'))).not.toContain(
      'space_before_punct',
    )
  })
})

describe('곧은/굽은 큰따옴표 혼용', () => {
  it('굽은 것이 이미 있고 곧은 것이 짝수면 짝지어 바꾼다', () => {
    // V4 실측: 굽은 “ ” 2개 · 곧은 " 2개.
    const mixed = 'He said “yes” and she said "no" to us.'
    expect(pairStraightQuotes(mixed)).toBe('He said “yes” and she said “no” to us.')
    expect(rules(pairStraightQuotes(mixed))).not.toContain('quote_style')
  })

  it('처음부터 곧은 것으로 통일된 글은 그대로 둔다', () => {
    // 섞인 게 아니면 고칠 이유가 없다 — 손대면 출처의 표기를 우리가 바꾸는 것이다.
    const straight = 'He said "yes" and she said "no" to us.'
    expect(pairStraightQuotes(straight)).toBe(straight)
  })

  it('홀수면 어느 쪽이 열린 것인지 모르므로 그대로 둔다', () => {
    const odd = 'He said “yes” and then " trailed off'
    expect(pairStraightQuotes(odd)).toBe(odd)
  })
})

describe('글머리에 눌어붙은 절 제목', () => {
  it('실측 2건을 고친다', () => {
    expect(dropDuplicatedLeadWord('Filming Filming began in August 2019.')).toBe(
      'Filming began in August 2019.',
    )
    expect(dropDuplicatedLeadWord('APOD APOD Astronomy Picture of the Day')).toBe(
      'APOD Astronomy Picture of the Day',
    )
  })

  it('문장 가운데의 겹침은 건드리지 않는다 — 실제 이름일 수 있다', () => {
    // `Durand Durand` 는 Barbarella 악당의 진짜 이름이다. 자리를 맨 앞으로 좁혀야 안전하다.
    const name = 'They sent the president to retrieve Durand Durand from Tau Ceti.'
    expect(dropDuplicatedLeadWord(name)).toBe(name)
  })

  it('소문자로 시작하면 제목이 아니다', () => {
    const s = 'had had enough of the noise.'
    expect(dropDuplicatedLeadWord(s)).toBe(s)
  })

  it('한 번만 지운다 — 세 번 겹치면 두 번째까지만 남는다', () => {
    expect(dropDuplicatedLeadWord('APOD APOD APOD text')).toBe('APOD APOD text')
  })
})
