// packages/library-pipeline/src/textbook/excerpt.test.ts
//
// **발췌는 난이도를 바꾼다** — 그래서 자른 뒤 다시 재는 것이 이 모듈의 존재 이유다.
// 실측(StoryWeaver L2·L3 28권): 원본 대비 **평균 −0.43 · 최소 −3.74 · 최대 +2.05**.
// 원본 FK 로 칸을 정했으면 세 칸까지 어긋났다.

import { describe, expect, it } from 'vitest'

import { excerptForBand, fitExcerptToAnyBand } from './excerpt'
import { bandOf, gradeBand, readability, syllables, READING_LEVEL_BANDS } from './readability'

/**
 * **초5~6 칸 픽스처(실측 FK 4.7~5.0 · 문장 9.6어).**
 * 이 칸이 바로 재고가 9편뿐이던 구멍이다 — 시중 초5~6 교재가 FK 4.42 · 문장 9.3어다.
 */
const mid = [
  'Mina lives beside a river in a quiet village.',
  'Every morning she carries water home for her family.',
  'The path is muddy after the summer rain falls.',
  'One day she finds a small turtle near the water.',
  'She carries it gently and shows it to her mother.',
  'Her mother smiles and tells her to return it later.',
  'Mina walks back and places the turtle in the river.',
  'The turtle swims away quickly and disappears under a rock.',
]

/**
 * 짧은 문장으로만 된 이야기 — 실측 FK −0.75 로 **초3 미만**이다.
 * 지어낸 값이 아니라 StoryWeaver L1 이 실제로 이 구간이었다(실측 1.42).
 */
const easy = [
  'Manu has a red coat.',
  'He wants to wear it.',
  'Ma says no. The sky is clear.',
  'Manu waits. He waits all day.',
  'On Friday it rains at last.',
  'Manu runs out. He is very happy.',
  'His coat is wet. He does not mind.',
  'Ma laughs and calls him home.',
]

/** 긴 문장·긴 낱말 — 어려운 쪽. */
const hard = [
  'The extraordinary photosynthetic mechanism demonstrates remarkable adaptability across environmental conditions.',
  'Consequently, investigators established comprehensive methodologies for evaluating chlorophyll concentration variability.',
  'Subsequent observations confirmed that atmospheric particulates significantly influence measurable absorption characteristics.',
  'Nevertheless, contemporary instrumentation permits unprecedented resolution regarding cellular metabolic transformation.',
]

describe('readability 눈금', () => {
  it('문장이나 낱말이 없으면 null 이다 — 0 을 돌려주지 않는다', () => {
    // 0 은 "아주 쉽다" 로 읽혀 잴 수 없는 글이 초등 칸에 들어간다.
    expect(readability('')).toBeNull()
    expect(readability('낱말 없는 한국어 문장입니다')).toBeNull()
    expect(readability('no sentence end')).toBeNull()
  })

  it('음절을 센다 — 끝의 묵음 e 는 세지 않는다', () => {
    expect(syllables('make')).toBe(1)
    expect(syllables('cat')).toBe(1)
    expect(syllables('banana')).toBe(3)
  })

  it('쉬운 글이 어려운 글보다 FK 가 낮다', () => {
    const e = readability(mid.join(' '))!
    const h = readability(hard.join(' '))!
    expect(e.fk).toBeLessThan(h.fk)
  })

  it('창 밖은 위아래를 구분해 말한다 — 미달과 초과는 처방이 다르다', () => {
    expect(bandOf(0.5)).toBe('초3 미만')
    expect(bandOf(20)).toBe('중3 초과')
    expect(bandOf(null)).toBe('알 수 없음')
  })

  it('학년 칸은 시중 실측 순서를 지킨다 — 단조 증가', () => {
    const fks = READING_LEVEL_BANDS.map((b) => b.marketFk)
    expect(fks).toEqual([...fks].sort((a, b) => a - b))
  })
})

describe('발췌', () => {
  it('첫머리부터 잘라 어수창에 넣는다', () => {
    const band = gradeBand('초5~6')!
    const c = excerptForBand(mid, band)
    expect(c).not.toBeNull()
    expect(c!.fromOpening).toBe(true)
    expect(c!.words).toBeGreaterThanOrEqual(band.wordsMin)
    expect(c!.words).toBeLessThanOrEqual(band.wordsMax)
  })

  it('문단 경계에서만 자른다 — 잘린 조각이 원문 문단의 이어붙임이다', () => {
    const c = excerptForBand(mid, gradeBand('초5~6')!)!
    const rebuilt = mid.slice(c.start, c.end).join(' ')
    // 문장 중간에서 잘랐다면 이 등식이 깨진다.
    expect(c.text).toBe(rebuilt)
  })

  it('**자른 뒤 다시 잰다** — 조각의 FK 가 목표 칸 안이다', () => {
    const band = gradeBand('초5~6')!
    const c = excerptForBand(mid, band)!
    const measured = readability(c.text)!
    expect(measured.fk).toBe(c.fk) // 보고한 값이 조각을 잰 값이어야 한다
    expect(c.fk).toBeGreaterThanOrEqual(band.fkMin)
    expect(c.fk).toBeLessThanOrEqual(band.fkMax)
  })

  it('칸에 못 들면 null 이다 — 억지로 맞춘 조각을 내지 않는다', () => {
    // 쉬운 이야기는 중3 칸(FK 8.5~12)에 들 수 없다.
    expect(excerptForBand(easy, gradeBand('중3')!)).toBeNull()
  })

  it('빈 입력에 터지지 않는다', () => {
    expect(excerptForBand([], gradeBand('초5~6')!)).toBeNull()
    expect(excerptForBand(['', '  '], gradeBand('초5~6')!)).toBeNull()
  })

  it('allowMidStory=false 면 첫머리 조각만 낸다', () => {
    const c = excerptForBand(mid, gradeBand('초5~6')!, { allowMidStory: false })
    if (c) expect(c.fromOpening).toBe(true)
  })

  it('어느 칸이든 맞춰 보면 원본 대비 이동폭을 함께 낸다', () => {
    const fit = fitExcerptToAnyBand(mid)
    expect(fit).not.toBeNull()
    expect(fit!.sourceFk).not.toBeNull()
    // 이동폭이 곧 "원본 FK 로 칸을 정하면 안 되는 이유" 다.
    expect(fit!.fkShift).toBe(+(fit!.fk - fit!.sourceFk!).toFixed(2))
  })

  it('첫머리 조각이 있으면 뒤쪽 조각보다 먼저 쓴다', () => {
    // 첫머리가 아니면 대명사가 설명 없이 나온다 — 쓸 수는 있지만 첫머리가 낫다.
    const c = excerptForBand(mid, gradeBand('초5~6')!)!
    expect(c.start).toBe(0)
  })
})
