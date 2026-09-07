// packages/library-pipeline/src/textbook/vocab-choice.test.ts
//
// 어휘(수능 30번) 회귀. 지키려는 것은 **바뀐 낱말이 지문 안에서 모순으로 보이는가** 다.
// 문장 하나만 놓고 보면 반대말도 자연스럽다 — 틀렸다는 건 글의 나머지와 어긋날 때만 드러난다.

import { describe, expect, it } from 'vitest'
import {
  buildVocabChoice,
  MIN_CHAIN_OCCURRENCES,
  spread,
  VOCAB_UNDERLINES,
  type VocabLexicon,
} from './vocab-choice'

const ANTONYMS: Record<string, string[]> = {
  increase: ['decrease'],
  decrease: ['increase'],
  expensive: ['cheap'],
  distant: ['nearby'],
  simple: ['complex'],
}
const POS: Record<string, string> = {
  increase: 'verb',
  decrease: 'verb',
  expensive: 'adjective',
  cheap: 'adjective',
  distant: 'adjective',
  nearby: 'adjective',
  simple: 'adjective',
  complex: 'adjective',
}
const lex: VocabLexicon = {
  antonymsOf: (w) => ANTONYMS[w] ?? [],
  posOf: (w) => POS[w] ?? null,
}

/**
 * 지문을 규격 안으로 늘린다.
 *
 * 생성기가 **90~200어 구간을 잘라 쓰므로**(`selectPassageWindow`) 짧은 픽스처는 통째로
 * 탈락한다. 문장마다 같은 꼬리를 붙여 낱말 수만 채운다 — 꼬리에는 반대말이 없어
 * 바꿀 후보가 늘지 않고, 관사·지시사도 없어 어법 후보도 늘지 않는다.
 */
const PAD = 'according to the regional planning office released earlier last quarter'
const long = (ss: readonly string[]): string[] => ss.map((s) => s.replace(/\.$/, ` ${PAD}.`))

// `expensive` 가 세 번 나온다 — 한 자리를 `cheap` 으로 바꿔도 나머지 둘이 남아 모순이 보인다.
const sentences = long([
  'Rooftop solar panels remain expensive across most of the northern districts.',
  'Councils argue that expensive equipment discourages ordinary households from applying.',
  'Installers report that expensive permits add several weeks to every project.',
  'Regional grants cover roughly a third of the reported installation costs.',
  'Officials expect another review of the programme before the winter season.',
])

describe('어휘 문항', () => {
  it('밑줄 다섯을 걸고 그중 하나만 반대말로 바뀐다', () => {
    const item = buildVocabChoice(sentences, lex)
    expect(item).not.toBeNull()
    expect(item!.underlines).toHaveLength(VOCAB_UNDERLINES)
    expect(item!.answer).toBeGreaterThanOrEqual(1)
    expect(item!.answer).toBeLessThanOrEqual(VOCAB_UNDERLINES)
    expect(item!.original).toBe('expensive')
  })

  it('바뀐 낱말은 한 번, 원래 낱말은 그대로 남는다 — 이것이 모순의 근거다', () => {
    const item = buildVocabChoice(sentences, lex)!
    const body = item.sentences.join(' ').toLowerCase()
    expect((body.match(/\bcheap\b/g) ?? []).length).toBe(1)
    expect((body.match(/\bexpensive\b/g) ?? []).length).toBeGreaterThanOrEqual(
      MIN_CHAIN_OCCURRENCES - 1,
    )
  })

  it('정답 자리의 밑줄에는 바뀐 낱말이 보인다', () => {
    const item = buildVocabChoice(sentences, lex)!
    expect(item.underlines[item.answer - 1]!.word.toLowerCase()).toBe('cheap')
  })

  it('한 번만 나오는 낱말은 바꾸지 않는다 — 어긋난 데가 안 보인다', () => {
    const once = long([
      'Rooftop solar panels remain expensive across the northern districts.',
      'Councils publish quarterly figures about household applications.',
      'Installers report longer waits during the summer months.',
      'Regional grants cover roughly a third of installation costs.',
      'Officials expect another review before the winter season.',
    ])
    expect(buildVocabChoice(once, lex)).toBeNull()
  })

  it('반대말이 이미 글에 있으면 바꾸지 않는다 — 어느 쪽이 어긋난 건지 갈린다', () => {
    const both = long([
      'Rooftop panels remain expensive across the northern districts today.',
      'Councils argue that expensive equipment discourages ordinary households.',
      'Imported panels are far cheap by comparison with local products.',
      'Regional grants cover roughly a third of installation costs.',
      'Officials expect another review before the winter season.',
    ])
    expect(buildVocabChoice(both, lex)).toBeNull()
  })

  it('품사가 다른 반대말은 쓰지 않는다', () => {
    const mismatched: VocabLexicon = {
      antonymsOf: (w) => (w === 'expensive' ? ['cheaply'] : []),
      posOf: (w) => (w === 'cheaply' ? 'adverb' : POS[w] ?? null),
    }
    expect(buildVocabChoice(sentences, mismatched)).toBeNull()
  })

  it('문장이 다섯 개보다 적으면 만들지 않는다', () => {
    expect(buildVocabChoice(sentences.slice(0, 4), lex)).toBeNull()
  })

  it('멱등하다', () => {
    expect(buildVocabChoice(sentences, lex)).toEqual(buildVocabChoice(sentences, lex))
  })

  it('밑줄은 서로 다른 문장에 흩어지고 정답 자리를 포함한다', () => {
    const item = buildVocabChoice(sentences, lex)!
    const idx = item.underlines.map((u) => u.sentenceIdx)
    expect(new Set(idx).size).toBe(idx.length)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx) // 읽는 순서대로
    expect(item.underlines[item.answer - 1]!.word.toLowerCase()).toBe('cheap')
  })

  it('고르게 뽑는다 — 앞뒤로 몰리지 않는다', () => {
    expect(spread([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([0, 3, 6, 9])
    expect(spread([1, 2], 5)).toEqual([1, 2]) // 모자라면 있는 만큼
    expect(spread([1, 2, 3], 0)).toEqual([])
  })

  it('**정답 번호가 만들 수 있는 범위 안에서 고르게 퍼진다** — 쏠리면 찍어서 맞는다', () => {
    // 문장 수가 늘수록 정답이 놓일 수 있는 번호가 늘어난다. 같은 지문 모양에서
    // 바꿀 낱말의 자리만 다를 때 번호가 한쪽에 뭉치지 않아야 한다.
    const seen = new Set<number>()
    for (let extra = 0; extra < 6; extra++) {
      const body = [
        ...sentences,
        ...Array.from(
          { length: extra },
          (_, i) => `Local reviewers noted expensive delays in district number ${i} again ${PAD}.`,
        ),
      ]
      const item = buildVocabChoice(body, lex)
      if (item) seen.add(item.answer)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('문장 첫머리 낱말을 바꿔도 대문자를 지킨다', () => {
    const capital = long([
      'Expensive permits delayed the northern rooftop programme by several weeks.',
      'Councils argue that expensive equipment discourages ordinary households here.',
      'Installers report that expensive reviews add weeks to every single project.',
      'Regional grants cover roughly a third of the installation costs reported.',
      'Officials expect another review of the programme before the winter season.',
    ])
    const item = buildVocabChoice(capital, lex)
    if (item && item.sentences[0]!.startsWith('Cheap')) {
      expect(item.sentences[0]).toMatch(/^Cheap\b/)
    }
    // 어느 자리가 뽑히든 소문자로 시작하는 문장이 생기면 안 된다.
    for (const s of item?.sentences ?? []) expect(s).toMatch(/^[A-Z]/)
  })
})
