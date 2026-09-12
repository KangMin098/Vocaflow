// packages/library-pipeline/src/textbook/middle-choice.test.ts
//
// **객관식의 위험은 단답과 다르다 — 오답이 정답과 겹치면 답이 둘이 된다.**
//
// 단답은 정답의 유일성이 문제였다(`middle-short.test.ts`). 객관식은 오답을 우리가
// 만들기 때문에, 오답이 정답과 뜻이 겹치거나 지문 안에 이미 있으면 학습자가
// 맞는 답을 골라도 틀렸다고 채점된다. 그래서 여기서 재는 것은 **오답의 무해성**이다.

import { describe, expect, it } from 'vitest'

import {
  buildUnitVocab,
  buildUnitGrammar,
  MIDDLE_CHOICES,
  MIDDLE_ITEM_WORDS,
  MIDDLE_GRAMMAR_UNDERLINES,
} from './middle-choice'
import type { ElementaryWord } from './elementary'

const w = (word: string, meaningKo: string, synonyms?: string[]): ElementaryWord => ({
  word,
  meaningKo,
  rhymeKey: null,
  synonyms,
})

/** 40~120어 규격에 드는 지문. 두 문장 이상이어야 창이 잡힌다. */
const PARAGRAPH = [
  'Scientists studied a distant planet for many years using powerful ground telescopes.',
  'They wanted to learn whether the rocky surface could hold liquid water somewhere below.',
  'The research team published their findings in a well known scientific journal last spring.',
  'Many readers found the results surprising because earlier studies had reached other conclusions.',
]

const POOL: ElementaryWord[] = [
  w('telescopes', '망원경'),
  w('surface', '표면'),
  w('journal', '학술지'),
  w('mountain', '산'),
  w('kitchen', '부엌'),
  w('bicycle', '자전거'),
  w('weather', '날씨'),
  w('teacher', '교사'),
]
const BY_WORD = new Map(POOL.map((x) => [x.word, x]))
const lookup = (word: string) => BY_WORD.get(word) ?? null

describe('본문 어휘 뜻 — 오답이 정답을 침범하지 않는다', () => {
  const item = buildUnitVocab(PARAGRAPH, lookup, POOL)

  it('4지선다이고 정답 번호가 범위 안이다', () => {
    expect(item).not.toBeNull()
    expect(item!.choices).toHaveLength(MIDDLE_CHOICES)
    expect(item!.answer).toBeGreaterThanOrEqual(1)
    expect(item!.answer).toBeLessThanOrEqual(MIDDLE_CHOICES)
  })

  it('묻는 낱말이 지문 안에 있다 — 지문 밖 낱말을 물으면 본문 어휘 문항이 아니다', () => {
    expect(item!.sentences.join(' ').toLowerCase()).toContain(item!.target)
  })

  it('정답 보기가 그 낱말의 뜻이다', () => {
    expect(item!.choices[item!.answer - 1]!.text).toBe(BY_WORD.get(item!.target)!.meaningKo)
  })

  it('보기끼리 겹치지 않는다 — 겹치면 보기가 넷이 아니라 셋이다', () => {
    const texts = item!.choices.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('지문에 있는 낱말의 뜻은 오답으로 쓰지 않는다 — 학습자가 지문에서 보고 헷갈린다', () => {
    const inPassage = new Set(
      item!.sentences.join(' ').toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z]/g, '')),
    )
    const wrong = item!.choices.filter((_, i) => i !== item!.answer - 1).map((c) => c.text)
    for (const t of wrong) {
      const owner = POOL.find((p) => p.meaningKo === t)
      if (owner) expect(inPassage.has(owner.word.toLowerCase())).toBe(false)
    }
  })

  it('유의어의 뜻은 오답이 되지 않는다 — 답이 둘이 된다', () => {
    const syn = buildUnitVocab(
      PARAGRAPH,
      (word) => (word === 'telescopes' ? w('telescopes', '망원경', ['surface']) : BY_WORD.get(word) ?? null),
      POOL,
    )
    if (syn && syn.target === 'telescopes') {
      const wrong = syn.choices.filter((_, i) => i !== syn.answer - 1).map((c) => c.text)
      expect(wrong).not.toContain('표면')
    }
  })

  it('사전에 뜻이 없으면 만들지 않는다', () => {
    expect(buildUnitVocab(PARAGRAPH, () => null, POOL)).toBeNull()
  })

  it('오답 후보가 모자라면 만들지 않는다', () => {
    expect(buildUnitVocab(PARAGRAPH, lookup, POOL.slice(0, 2))).toBeNull()
  })

  it('같은 지문이면 늘 같은 문항이 나온다', () => {
    const a = buildUnitVocab(PARAGRAPH, lookup, POOL)!
    const b = buildUnitVocab(PARAGRAPH, lookup, POOL)!
    expect(a.target).toBe(b.target)
    expect(a.answer).toBe(b.answer)
  })
})

describe('단원 문법 — 중등 규격이 수능과 섞이지 않는다', () => {
  // 부정관사 후보가 넉넉한 지문.
  const GRAMMAR_PARAGRAPH = [
    'The team found a distant planet and a rocky moon during a long survey.',
    'A researcher described a strange signal that arrived from a nearby star system.',
    'They later confirmed a second signal using a different telescope in another country.',
    'The discovery gave a new direction to a field that had moved slowly for years.',
  ]
  const item = buildUnitGrammar(GRAMMAR_PARAGRAPH)

  it('밑줄이 넷이다 — 수능(다섯)과 다르다', () => {
    expect(item).not.toBeNull()
    expect(item!.underlines).toHaveLength(MIDDLE_GRAMMAR_UNDERLINES)
    expect(item!.choices).toHaveLength(MIDDLE_CHOICES)
  })

  it('지문이 중등 규격 안이다', () => {
    const words = item!.sentences.join(' ').split(/\s+/).filter(Boolean).length
    expect(words).toBeGreaterThanOrEqual(MIDDLE_ITEM_WORDS.min)
    expect(words).toBeLessThanOrEqual(MIDDLE_ITEM_WORDS.max)
  })

  it('정답 자리만 틀린 형태다 — 나머지 밑줄은 원문 그대로', () => {
    const target = item!.underlines[item!.answer - 1]!
    const tokens = item!.sentences[target.sentenceIdx]!.split(/\s+/)
    expect(tokens[target.tokenIdx]).toBe(target.word)
    expect(target.word.toLowerCase()).not.toBe(item!.original.toLowerCase())
  })

  it('밑줄이 한 문장에 몰리지 않는다 — 몰리면 나머지를 안 읽어도 풀린다', () => {
    const perSentence = new Set(item!.underlines.map((u) => u.sentenceIdx))
    expect(perSentence.size).toBeGreaterThan(1)
  })

  it('후보가 모자라면 만들지 않는다', () => {
    expect(buildUnitGrammar(['The results were published in several journals worldwide.'])).toBeNull()
  })

  it('같은 지문이면 늘 같은 정답이 나온다', () => {
    const a = buildUnitGrammar(GRAMMAR_PARAGRAPH)!
    const b = buildUnitGrammar(GRAMMAR_PARAGRAPH)!
    expect(a.answer).toBe(b.answer)
    expect(a.sentences).toEqual(b.sentences)
  })
})

describe('규격은 시장 실측에 고정된다', () => {
  it('중등 보기 수는 시중 지배값과 같다 — 근거 없는 상수로 되돌아가지 않게', async () => {
    const spec = (await import('./market-spec.json')).default as {
      choiceCount: Record<string, { dominant: number; fiveChoiceRate: number }>
    }
    const mid = spec.choiceCount['중등']!
    // 2026-08-30 실측: 중등 문항 225개 중 93.8%가 5지선다였다.
    // 그 전에는 이 파일이 "중등 4지선다" 라고 적고 4,135문항을 그렇게 만들었다.
    expect(mid.dominant).toBe(MIDDLE_CHOICES)
    expect(mid.fiveChoiceRate).toBeGreaterThan(0.9)
  })

  it('밑줄 수와 보기 수는 같다 — 밑줄 하나가 보기 하나다', () => {
    expect(MIDDLE_GRAMMAR_UNDERLINES).toBe(MIDDLE_CHOICES)
  })
})
