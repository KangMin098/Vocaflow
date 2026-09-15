// packages/library-pipeline/src/textbook/word-order.test.ts
//
// 영작 배열 회귀. 지키려는 것은 **정답이 하나로 확정되는가** 와 **답을 흘리지 않는가** 다.

import { describe, expect, it } from 'vitest'
import { buildWordOrder, deterministicShuffle, WORD_ORDER_WORDS } from './word-order'

const common = new Set(['the', 'they', 'we', 'engineers', 'fishing', 'coastal', 'a', 'an', 'his'])
const isCommon = (w: string) => common.has(w.toLowerCase())

describe('영작 배열 문항', () => {
  const sentence = 'The engineers rebuilt every harbour wall along that northern shore.'

  it('원문이 정답이고 낱말 뭉치는 어순이 다르다', () => {
    const item = buildWordOrder(sentence, null, isCommon)
    expect(item).not.toBeNull()
    expect(item!.answer).toBe(sentence)
    expect(item!.bank.join(' ')).not.toBe(sentence.replace(/\.$/, ''))
  })

  it('낱말 뭉치는 원문 낱말과 같은 집합이다 — 끝 부호만 뗀다', () => {
    const item = buildWordOrder(sentence, null, isCommon)!
    const original = sentence.replace(/\.$/, '').split(' ')
    expect(item.bank).toHaveLength(original.length)
    // 대소문자만 다를 수 있다(첫 낱말 내림). 그 외에는 한 낱말도 늘거나 줄지 않는다.
    const norm = (a: string[]) => [...a].map((w) => w.toLowerCase()).sort()
    expect(norm(item.bank)).toEqual(norm(original))
  })

  it('첫 낱말이 흔한 낱말이면 소문자로 내린다 — 대문자가 답을 흘린다', () => {
    const item = buildWordOrder(sentence, null, isCommon)!
    expect(item.bank).toContain('the')
    expect(item.bank).not.toContain('The')
  })

  it('고유명사는 그대로 둔다', () => {
    const s = 'Prague opened another river ferry beside that ancient stone bridge.'
    const item = buildWordOrder(s, null, isCommon)!
    expect(item.bank).toContain('Prague')
  })

  it('같은 낱말이 두 번 나오면 만들지 않는다 — 정답이 갈린다', () => {
    expect(buildWordOrder('The crew rebuilt the wall beside another wall.', null, isCommon)).toBeNull()
  })

  it('낱말 수 범위를 벗어나면 만들지 않는다', () => {
    expect(buildWordOrder('They left.', null, isCommon)).toBeNull()
    const long = 'They quietly rebuilt every single harbour wall along that entire northern coastal shoreline yesterday.'
    expect(long.replace(/\.$/, '').split(' ').length).toBeGreaterThan(WORD_ORDER_WORDS.max)
    expect(buildWordOrder(long, null, isCommon)).toBeNull()
  })

  it('문장 안에 부호가 있으면 만들지 않는다 — 부호가 자리를 알려 준다', () => {
    expect(buildWordOrder('They rebuilt it, and everyone returned home again.', null, isCommon)).toBeNull()
    expect(buildWordOrder('He shouted "stop" before anyone else could move.', null, isCommon)).toBeNull()
  })

  it('숫자나 기호가 섞이면 만들지 않는다', () => {
    expect(buildWordOrder('They rebuilt 3 walls along that northern shore.', null, isCommon)).toBeNull()
  })

  it('앞 문장을 문맥으로 함께 준다 — 우리말 뜻이 없으므로', () => {
    const item = buildWordOrder(sentence, 'The storm had flattened the old defences.', isCommon)!
    expect(item.context).toBe('The storm had flattened the old defences.')
  })

  it('멱등하다', () => {
    expect(buildWordOrder(sentence, null, isCommon)).toEqual(buildWordOrder(sentence, null, isCommon))
  })

  it('셔플은 같은 seed 면 같고 다른 seed 면 다르다', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    expect(deterministicShuffle(items, 'x')).toEqual(deterministicShuffle(items, 'x'))
    expect(deterministicShuffle(items, 'x')).not.toEqual(deterministicShuffle(items, 'y'))
  })
})

/**
 * **정답이 둘이면 채점이 갈린다.**
 *
 * 3인 검수 청크 둘이 각자 짚었다(chunk-00 · chunk-01). 실물은 chunk-00 의 것이다 —
 * 같은 낱말 뭉치로 `He therefore borrowed …` 와 `Therefore he borrowed …` 가 둘 다 선다.
 * 재고 실측 48,855건 중 4,133건(8.5%).
 */
describe('자리를 옮겨도 되는 부사는 정답을 둘로 만든다', () => {
  const common = new Set(['he', 'they', 'we', 'the', 'a', 'their', 'she', 'it'])
  const isCommon = (w: string) => common.has(w.toLowerCase())

  it('검수가 짚은 실물을 막는다', () => {
    expect(buildWordOrder('He therefore borrowed a horse from Wilkins.', null, isCommon)).toBeNull()
  })

  it.each([
    'therefore', 'thus', 'however', 'instead', 'finally', 'then',
    'now', 'often', 'usually', 'sometimes', 'perhaps', 'suddenly',
  ])('`%s` 가 든 문장은 만들지 않는다', (adv) => {
    expect(buildWordOrder(`They ${adv} rebuilt the northern harbour wall.`, null, isCommon)).toBeNull()
  })

  // ⚠️ **부정 부사는 대안이 아니다** — 앞으로 내면 도치가 필요해 낱말이 하나 는다
  //   (`Rarely do we hear…`). 같은 뭉치로 만들 수 없으므로 막을 이유가 없다.
  it.each(['rarely', 'seldom', 'never', 'always'])('`%s` 는 막지 않는다 — 도치가 필요하다', (adv) => {
    expect(buildWordOrder(`They ${adv} rebuilt the northern harbour wall.`, null, isCommon)).not.toBeNull()
  })

  // ⚠️ `not only … but also` 의 `also` 는 붙박이다(표본에서 실제로 걸렸다).
  it('`but also` 의 `also` 는 막지 않는다', () => {
    expect(
      buildWordOrder('They found it in harbours but also along northern shores.', null, isCommon),
    ).not.toBeNull()
    // `but` 이 없으면 옮길 수 있으므로 막는다.
    expect(buildWordOrder('They also rebuilt the northern harbour wall.', null, isCommon)).toBeNull()
  })
})

/**
 * **뭉치에 대문자 낱말이 하나면 첫 자리가 공짜로 정해진다.**
 *
 * 첫 글자 내리기를 사전(`isCommonWord`)에만 맡겨서 **3,182건(6.5%)** 이 `Their`·`These`·`Such`
 * 를 대문자로 달고 나갔다(3인 검수 chunk-01 이 `Their` 로 짚었다). 기능어는 고유명사일 수
 * 없으므로 사전을 물을 이유가 없다.
 */
describe('기능어는 사전을 묻지 않고 내린다', () => {
  // 사전이 이 낱말들을 모른다고 가정한다 — 실제로 그랬다.
  const emptyDict = () => false

  it.each(['Their', 'These', 'Such', 'Another', 'Every', 'While', 'Between'])(
    '`%s` 로 시작해도 대문자가 남지 않는다',
    (word) => {
      const item = buildWordOrder(`${word} builders rebuilt the northern harbour wall.`, null, emptyDict)
      expect(item).not.toBeNull()
      expect(item!.bank.filter((w) => /^[A-Z]/.test(w)), item!.bank.join(' ')).toEqual([])
    },
  )

  // ⚠️ **고유명사는 그대로 둔다** — 내리면 낱말이 망가진다.
  it('고유명사는 대문자를 지킨다', () => {
    const item = buildWordOrder('Prague builders rebuilt the northern harbour wall.', null, emptyDict)
    expect(item).not.toBeNull()
    expect(item!.bank).toContain('Prague')
  })
})
