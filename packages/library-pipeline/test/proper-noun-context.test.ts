// packages/library-pipeline/test/proper-noun-context.test.ts
// 대문자 고유명사 가드 + 예문·context_pos 일치 회귀 — 2026-10-28.
//
// 배경(R0 USGS 진단): winkNLP 가 "Ford's Theatre" 의 Ford 를 NOUN 으로 태깅해 일반어 `ford`
// 가 학습 어휘로 들어갔고, context_pos 는 글 전체 다수결인데 예문은 첫 등장이라 품사가 어긋났다.

import { describe, it, expect } from 'vitest'
import { extractBookLemmas } from '../src/analyze/extract-lemmas'
import type { ChapterSegment } from '../src/types'

function chapter(content: string): ChapterSegment {
  return {
    chapter_idx: 1,
    title: 'Test',
    content,
    word_count: content.split(/\s+/).length,
    char_start: 0,
    char_end: content.length,
  } as ChapterSegment
}

function occ(content: string, lemma: string) {
  return extractBookLemmas([chapter(content)]).occurrences.get(lemma)?.[0]
}

describe('대문자 고유명사 가드', () => {
  it("Ford's Theatre — 이름으로만 나오면 ford·theatre 둘 다 빠진다", () => {
    const text =
      "Ford's Theatre is a historic site in Washington. Visitors walk through Ford's Theatre every day."
    const idx = extractBookLemmas([chapter(text)])
    expect(idx.occurrences.has('ford')).toBe(false)
    expect(idx.occurrences.has('theatre')).toBe(false)
    expect(idx.occurrences.has('theater')).toBe(false)
    expect(idx.occurrences.has('site')).toBe(true)
  })

  it("Lincoln's Cottage — 문장 중간 이름(President 포함)도 빠진다", () => {
    const idx = extractBookLemmas([chapter("Tourists often visit President Lincoln's Cottage in the spring.")])
    expect(idx.occurrences.has('cottage')).toBe(false)
    expect(idx.occurrences.has('president')).toBe(false)
    expect(idx.occurrences.has('spring')).toBe(true)
  })

  it('문장 첫머리 대문자 일반어는 남는다', () => {
    // winkNLP 가 NOUN 으로 태깅한 문장 첫 대문자 (Rain · Fish) — 가드가 건드리지 않는다
    const text = 'Rain adds water to the river. Fish live in clean water.'
    const o = occ(text, 'rain')
    expect(o).toBeDefined()
    expect(o?.first_sentence_in_chapter).toContain('Rain adds')
    expect(occ(text, 'fish')).toBeDefined()
  })

  it('이름·일반어 혼용 — 일반어 등장만 세고 그 문장을 예문으로 쓴다', () => {
    const text = 'The Cottage Museum opened last year. They rented a small cottage near the lake.'
    const o = occ(text, 'cottage')
    expect(o).toBeDefined()
    expect(o?.frequency_in_chapter).toBe(1)
    expect(o?.first_sentence_in_chapter).toContain('small cottage')
  })
})

describe('예문은 context_pos 등장에서 뽑는다', () => {
  it('water — 앞선 동사 용례가 있어도 명사 문장을 예문으로 쓴다', () => {
    const text =
      'We water the plants every morning. The water in the lake was cold. ' +
      'Fish live in clean water. Rain adds water to the river.'
    const o = occ(text, 'water')
    expect(o).toBeDefined()
    expect(o?.frequency_in_chapter).toBe(4)
    expect(o?.context_pos).toBe('noun')
    expect(o?.first_sentence_in_chapter).toBe('The water in the lake was cold.')
  })

  it('ground — 명사로 쓰인 문장을 예문으로 쓴다', () => {
    const text = 'The ground was wet after the rain. Kids played on the ground.'
    const o = occ(text, 'ground')
    expect(o?.context_pos).toBe('noun')
    expect(o?.first_sentence_in_chapter).toBe('The ground was wet after the rain.')
  })
})
