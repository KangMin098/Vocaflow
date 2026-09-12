// packages/library-pipeline/src/textbook/grammar-choice.test.ts
//
// 어법(수능 29번) 회귀. 지키려는 것은 **바꾼 자리가 반드시 틀리는가** 다.
// 원문이 이미 어긋나 있었다면 교체가 오히려 고쳐 버리고, 그러면 정답이 없는 문항이 된다.

import { describe, expect, it } from 'vitest'
import {
  buildGrammarChoice,
  GRAMMAR_UNDERLINES,
  looksPlural,
  pickSpread,
  standardArticle,
} from './grammar-choice'

/**
 * 지문을 규격 안으로 늘린다.
 *
 * 생성기가 **90~200어 구간을 잘라 쓰므로**(`selectPassageWindow`) 짧은 픽스처는 통째로
 * 탈락한다. 꼬리에 **관사·지시사를 넣지 않는다** — 처음엔 `that same year` 로 끝냈다가
 * `that` 이 지시사 후보로 잡혀, "예외는 건드리지 않는다" 회귀가 엉뚱하게 통과해 버렸다.
 * 픽스처를 늘릴 때는 늘리는 재료가 무엇을 만드는지도 봐야 한다.
 */
const PAD = 'according to the regional planning office released earlier last quarter'
const long = (ss: readonly string[]): string[] => ss.map((s) => s.replace(/\.$/, ` ${PAD}.`))

const sentences = long([
  'An engineer joined the team during a quiet week in early autumn.',
  'These panels were shipped from a factory near the eastern border.',
  'The council approved an increase before the winter season began.',
  'Those reports arrived after a delay of nearly three months.',
  'Every installer received a manual and an extra set of tools.',
])

describe('표준형 판정', () => {
  it('모음 글자로 시작하면 an', () => {
    expect(standardArticle('apple')).toBe('an')
    expect(standardArticle('increase')).toBe('an')
    expect(standardArticle('panel')).toBe('a')
  })

  it('형태로 복수를 가리되, 못 가르는 것은 null 로 둔다', () => {
    expect(looksPlural('panels')).toBe(true)
    expect(looksPlural('panel')).toBe(false)
    expect(looksPlural('news')).toBe(false) // -s 로 끝나지만 단수
    expect(looksPlural('series')).toBe(false)
    expect(looksPlural('analysis')).toBeNull() // -is 는 형태로 못 가른다
    expect(looksPlural('class')).toBeNull() // -ss 도
  })
})

describe('어법 문항', () => {
  it('밑줄 다섯 중 하나만 틀린 형태로 바뀐다', () => {
    const item = buildGrammarChoice(sentences)
    expect(item).not.toBeNull()
    expect(item!.underlines).toHaveLength(GRAMMAR_UNDERLINES)
    expect(item!.answer).toBeGreaterThanOrEqual(1)
    expect(item!.answer).toBeLessThanOrEqual(GRAMMAR_UNDERLINES)
    expect(item!.underlines[item!.answer - 1]!.word).not.toBe(item!.original)
  })

  it('바뀐 자리가 지문에 실제로 반영돼 있다', () => {
    const item = buildGrammarChoice(sentences)!
    const u = item.underlines[item.answer - 1]!
    const tokens = item.sentences[u.sentenceIdx]!.split(/\s+/)
    expect(tokens[u.tokenIdx]).toBe(u.word)
  })

  it('나머지 네 자리는 원문 그대로다', () => {
    const item = buildGrammarChoice(sentences)!
    for (let i = 0; i < item.underlines.length; i++) {
      if (i === item.answer - 1) continue
      const u = item.underlines[i]!
      expect(sentences[u.sentenceIdx]!.split(/\s+/)[u.tokenIdx]).toBe(u.word)
    }
  })

  it('바뀐 것 말고는 지문이 한 글자도 달라지지 않는다', () => {
    const item = buildGrammarChoice(sentences)!
    const changed = item.sentences.filter((s, i) => s !== sentences[i]).length
    expect(changed).toBe(1)
  })

  it('밑줄이 서로 다른 문장에 흩어진다', () => {
    const item = buildGrammarChoice(sentences)!
    const idx = item.underlines.map((u) => u.sentenceIdx)
    expect(new Set(idx).size).toBe(idx.length)
  })

  it('멱등하다', () => {
    expect(buildGrammarChoice(sentences)).toEqual(buildGrammarChoice(sentences))
  })

  it('원문이 표준형과 어긋나면 그 자리는 건드리지 않는다', () => {
    // `an hour` 는 자음 글자인데 an — 예외다. `a university` 는 모음 글자인데 a.
    // 둘 다 후보에서 빠져야 한다(빠지면 후보가 모자라 문항이 안 만들어진다).
    const exceptions = long([
      'They waited an hour beside a university gate.',
      'He waited an hour beside a university gate.',
      'She waited an hour beside a university gate.',
      'We waited an hour beside a university gate.',
      'Nobody waited an hour beside a university gate.',
    ])
    expect(buildGrammarChoice(exceptions)).toBeNull()
  })

  it('지시사 뒤 명사의 수를 못 가르면 건드리지 않는다', () => {
    // `-is` · `-ss` 로 끝나는 명사는 형태로 수를 못 가른다.
    // (`series` 는 다르다 — 단복수가 같은 것이 **알려진 사실**이라 단수로 확정된다.)
    const ambiguous = long([
      'This analysis reached a clear conclusion about the northern harbour.',
      'That analysis mentioned a second review of the eastern seawall.',
      'These class members prepared a summary for the regional council.',
      'Those class members received an answer before the winter began.',
      'This analysis included a table and an appendix for later reference.',
    ])
    const item = buildGrammarChoice(ambiguous)
    // 지시사는 전부 빠지므로 관사(`a`)만 후보로 남고, 문장마다 하나씩 다섯이면 만들어진다.
    if (item) {
      for (const u of item.underlines) {
        expect(['a', 'an']).toContain(u.word.toLowerCase().replace(/[^a-z]/g, ''))
      }
    }
  })

  it('후보가 다섯 문장에 못 미치면 만들지 않는다', () => {
    expect(buildGrammarChoice(sentences.slice(0, 3))).toBeNull()
  })

  it('문장 첫머리를 바꿔도 대문자를 지킨다', () => {
    const capital = long([
      'An engineer joined the team during a quiet week in autumn.',
      'These panels were shipped from a factory near the border.',
      'An increase was approved before the winter season began.',
      'Those reports arrived after a delay of nearly three months.',
      'A manual and an extra set of tools reached every installer.',
    ])
    const item = buildGrammarChoice(capital)
    for (const s of item?.sentences ?? []) expect(s).toMatch(/^[A-Z]/)
  })

  it('고르게 뽑는다 — 앞뒤로 몰리지 않는다', () => {
    const picked = pickSpread([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)
    expect(picked).toEqual([0, 2, 5, 7, 9])
    expect(pickSpread([1, 2, 3], 5)).toEqual([1, 2, 3])
  })
})
