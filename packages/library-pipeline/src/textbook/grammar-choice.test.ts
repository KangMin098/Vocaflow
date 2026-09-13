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
  candidateAt,
  headNounAt,
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
/**
 * **절을 끊는 부호가 붙은 낱말은 후보가 아니다.**
 *
 * ⚠️ 앞 줄의 「순수한 낱말만」 검사는 **끝의 구두점을 막지 못한다** — 양쪽이 그 부호를 똑같이
 * 떼어 내므로 `"Analogously,"` 는 통과한다. 어휘 쪽에서 같은 자국을 고친 뒤 저장분을
 * 재생성해 보니 이 유형에서만 남았다(실측 2026-09-13 · 「만들었는데 자에 또 걸림 7건」).
 */
describe('밑줄 후보 — 붙은 부호', () => {
  it('쉼표·세미콜론·콜론이 붙은 낱말은 후보가 아니다', () => {
    for (const t of ['this,', 'these;', 'a:']) {
      expect(candidateAt([t, 'books'], 0, 0), t).toBeNull()
    }
  })

  it('부호가 없으면 그대로 후보다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    // 관사 규칙: 표준형과 맞을 때만 후보가 된다.
    expect(candidateAt(['a', 'book'], 0, 0)).not.toBeNull()
  })
})

/**
 * **`that` 은 지시사가 아닐 때가 많다.**
 *
 * 3인 검수 실측(2026-09-13): `…said that the deep-seated treachery…` 의 `that` 을
 * 지시사로 판정해 문항을 만들었고, 해설이 **「the 가 단수이므로 that 이 맞다」** 고 적었다.
 * 관사를 명사로 취급한 **없는 규칙**이다 — 학습자는 정답을 맞히고도 틀린 것을 배운다.
 *
 * 원인은 `looksPlural('the')` 가 「단수」를 내주는 것이었다(–s 로 안 끝나므로).
 * 그 함수가 틀린 게 아니라 **명사가 아닌 것에 물어본 것**이 틀렸다.
 */
describe('지시사 — 뒤가 명사구여야 한다', () => {
  it('명사절 접속사 `that` 은 후보가 아니다', () => {
    // 검수에서 나온 그 꼴.
    expect(candidateAt(['that', 'the', 'treachery'], 0, 0)).toBeNull()
    expect(candidateAt(['that', 'he', 'left'], 0, 0)).toBeNull()
    expect(candidateAt(['that', 'was', 'enough'], 0, 0)).toBeNull()
    expect(candidateAt(['that', 'in', 'winter'], 0, 0)).toBeNull()
  })

  it('진짜 지시사는 그대로 후보다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    const c = candidateAt(['that', 'panel'], 0, 0)
    expect(c).not.toBeNull()
    expect(c!.rule).toBe('demonstrative')
    expect(c!.broken).toBe('those')
    const p = candidateAt(['these', 'panels'], 0, 0)
    expect(p).not.toBeNull()
    expect(p!.broken).toBe('this')
  })

  it('관사 규칙은 이 검사의 대상이 아니다 — 관사는 뒤 낱말의 첫 글자만 본다', () => {
    expect(candidateAt(['a', 'panel'], 0, 0)).not.toBeNull()
  })
})

/**
 * **지시어의 수는 머리 명사로 판정한다 — 바로 뒤 낱말이 아니라.**
 *
 * 3인 검수 2회차 실측(2026-09-13): `even at these late hour` 로 문항이 만들어졌고
 * 해설이 **「late 가 단수이므로」** 라고 적었다. `late` 는 형용사라 수가 없고,
 * `these` 를 막는 것은 핵어 `hour` 다 — 해설에 `hour` 가 한 번도 안 나온다.
 *
 * 해설 작성기는 **이미 머리 명사를 찾고 있었다**(`explain-items.headNounAfter`).
 * 생성기만 못 받아서 둘이 갈렸다 — 이제 같은 함수를 쓴다.
 */
describe('지시어 — 머리가 확정될 때만 만든다', () => {
  it('수식어가 끼면 만들지 않는다 — 형용사와 명사는 형태로 안 갈린다', () => {
    // 검수가 찾은 그 꼴. `late` 를 명사로 여긴 해설이 「late 가 단수이므로」라고 적었다.
    expect(candidateAt(['these', 'late', 'hour'], 0, 0)).toBeNull()
    expect(candidateAt(['this', 'late', 'hour'], 0, 0)).toBeNull()
    expect(candidateAt(['These', 'class', 'members'], 0, 0)).toBeNull()
  })

  it('바로 뒤가 머리로 확정되면 그대로 후보다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    // 뒤에 기능어가 오면 앞 낱말이 머리다.
    const c = candidateAt(['these', 'panels', 'were', 'shipped'], 0, 0)
    expect(c).not.toBeNull()
    expect(c!.broken).toBe('this')
    // 문장 끝도 다툴 것이 없다.
    const d = candidateAt(['that', 'panel'], 0, 0)
    expect(d).not.toBeNull()
    expect(d!.broken).toBe('those')
  })

  /** 해설 쪽 스캔은 **이미 만들어진 문항**을 설명하는 자다 — 생성기는 이것에 기대지 않는다. */
  it('해설의 머리 명사 스캔은 형태상 수식어를 건너뛴다', () => {
    // 하이픈 복합어는 건너뛴다. 다만 `data`(명사 수식어)까지는 못 가른다 —
    // **그것이 이 스캔의 한계이고, 생성기가 여기에 기대지 않는 이유다.**
    expect(headNounAt(['those', 'AI-focused', 'data', 'centers'], 1)).toBe('data')
    expect(headNounAt(['that', 'the', 'treachery'], 1)).toBe('')
  })
})
