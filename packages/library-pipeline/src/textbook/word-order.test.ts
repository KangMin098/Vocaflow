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
