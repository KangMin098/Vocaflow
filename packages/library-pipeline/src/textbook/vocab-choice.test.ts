// packages/library-pipeline/src/textbook/vocab-choice.test.ts
//
// 어휘(수능 30번) 회귀. 지키려는 것은 **바뀐 낱말이 지문 안에서 모순으로 보이는가** 다.
// 문장 하나만 놓고 보면 반대말도 자연스럽다 — 틀렸다는 건 글의 나머지와 어긋날 때만 드러난다.

import { describe, expect, it } from 'vitest'
import {
  buildVocabChoice,
  MIN_CHAIN_OCCURRENCES,
  pickUnderlines,
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

// `expensive` 가 세 번 나온다 — 한 자리를 `cheap` 으로 바꿔도 나머지 둘이 남아 모순이 보인다.
const sentences = [
  'Rooftop solar panels remain expensive across most of the northern districts.',
  'Councils argue that expensive equipment discourages ordinary households from applying.',
  'Installers report that expensive permits add several weeks to every project.',
  'Regional grants cover roughly a third of the reported installation costs.',
  'Officials expect another review of the programme before the winter season.',
]

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
    const once = [
      'Rooftop solar panels remain expensive across the northern districts.',
      'Councils publish quarterly figures about household applications.',
      'Installers report longer waits during the summer months.',
      'Regional grants cover roughly a third of installation costs.',
      'Officials expect another review before the winter season.',
    ]
    expect(buildVocabChoice(once, lex)).toBeNull()
  })

  it('반대말이 이미 글에 있으면 바꾸지 않는다 — 어느 쪽이 어긋난 건지 갈린다', () => {
    const both = [
      'Rooftop panels remain expensive across the northern districts today.',
      'Councils argue that expensive equipment discourages ordinary households.',
      'Imported panels are far cheap by comparison with local products.',
      'Regional grants cover roughly a third of installation costs.',
      'Officials expect another review before the winter season.',
    ]
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

  it('밑줄은 정답 자리를 반드시 포함하고 지문에 퍼진다', () => {
    const cands = Array.from({ length: 9 }, (_, i) => ({ sentenceIdx: i }))
    const picked = pickUnderlines(cands, 6)
    expect(picked).toHaveLength(VOCAB_UNDERLINES)
    expect(picked.map((p) => p.sentenceIdx)).toContain(6)
    // 오름차순이고 중복이 없다.
    const idx = picked.map((p) => p.sentenceIdx)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(new Set(idx).size).toBe(idx.length)
  })

  it('문장 첫머리 낱말을 바꿔도 대문자를 지킨다', () => {
    const capital = [
      'Expensive permits delayed the northern rooftop programme by several weeks.',
      'Councils argue that expensive equipment discourages ordinary households here.',
      'Installers report that expensive reviews add weeks to every single project.',
      'Regional grants cover roughly a third of the installation costs reported.',
      'Officials expect another review of the programme before the winter season.',
    ]
    const item = buildVocabChoice(capital, lex)
    if (item && item.sentences[0]!.startsWith('Cheap')) {
      expect(item.sentences[0]).toMatch(/^Cheap\b/)
    }
    // 어느 자리가 뽑히든 소문자로 시작하는 문장이 생기면 안 된다.
    for (const s of item?.sentences ?? []) expect(s).toMatch(/^[A-Z]/)
  })
})
