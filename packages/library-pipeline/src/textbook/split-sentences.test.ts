// packages/library-pipeline/src/textbook/split-sentences.test.ts
//
// **자르는 자와 잡는 자가 같은 약어를 알아야 한다.**
//
// 3인 검수 chunk-00 이 두 문항에서 같은 자국을 짚었다 — 정답 문장이 `…from Mr.` 로 끝나고,
// 다른 문항은 `…the Gate of St.` 라는 동사 없는 조각이었다. 저장소의 문장 분할이 전부
// `/(?<=[.!?])\s+/` 뿐이라 약어 마침표에서 끊겼다.
//
// ⚠️ 그래서 이 회귀는 **자른 결과를 판정자에게 그대로 물린다**(`hasBadSentenceSplit`).
//   「약어가 안 잘리는가」만 보면 자는 좋아져도 판정자가 계속 버리는 경우를 못 본다 —
//   둘이 갈리는 것이 이 저장소가 여러 번 겪은 바로 그 결함이다.
import { describe, expect, it } from 'vitest'

import { splitSentences } from './csat-format'
import { hasBadSentenceSplit } from './item-hygiene'

/** 자른 결과를 문항 payload 모양으로 싸서 판정자에게 물린다. */
const judge = (text: string) => hasBadSentenceSplit({ sentences: splitSentences(text) })

describe('약어 마침표에서 문장을 끊지 않는다', () => {
  it.each([
    ['경칭', 'He therefore borrowed a horse from Mr. Wilkins. The road was long.'],
    ['지명 약칭', 'They walked past the Gate of St. Romanus. Beyond it lay the field.'],
    ['부인 경칭', 'Mrs. Hale taught the children. Few days were too cold.'],
    ['번호', 'The plate was marked No. 4 in red ink. Nobody knew why.'],
    ['박사', 'Dr. Frank examined the sample. The result came back clean.'],
    ['그림', 'The curve in Fig. 3 rises sharply. The authors offer no reason.'],
    ['라틴 약어', 'Some species, e.g. the barn owl, hunt at dusk. Others do not.'],
    ['시각', 'The bell rang at 8 a.m. Everyone was already awake.'],
  ])('%s — 조각이 생기지 않는다', (_label, text) => {
    expect(judge(text), splitSentences(text).join(' | ')).toBe(false)
  })

  it('`Mr.` 조각이 실제로 사라진다 — 판정자만 믿지 않는다', () => {
    const out = splitSentences('He borrowed a horse from Mr. Wilkins. The road was long.')
    expect(out).toEqual(['He borrowed a horse from Mr. Wilkins.', 'The road was long.'])
  })
})

describe('멀쩡한 문장 경계는 그대로 자른다', () => {
  it('평범한 두 문장', () => {
    expect(splitSentences('The tide rose twice that night. The boats pulled hard.')).toEqual([
      'The tide rose twice that night.',
      'The boats pulled hard.',
    ])
  })

  // ⚠️ **숫자는 약어가 아니다.** 여기에 숫자를 넣으면 진짜 문장 경계가 사라진다.
  it('숫자로 끝나는 문장은 자른다', () => {
    expect(splitSentences('He was 21. Then he left for the coast.')).toHaveLength(2)
  })

  it('물음표·느낌표도 경계다', () => {
    expect(splitSentences('Who left the gate open? Nobody answered!')).toHaveLength(2)
  })

  it('빈 글은 빈 조각 하나다', () => {
    expect(splitSentences('')).toEqual([''])
  })
})
