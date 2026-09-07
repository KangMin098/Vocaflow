// apps/web/src/components/game/scriptquiz/__tests__/ox-symbol.test.tsx
//
// **OX 문항에서 큰 O 가 「참」에 붙어 있는가.**
//
// 예전에는 기호가 `i === 0 ? 'O' : 'X'` 로 **자리**에 묶여 있었다. 그런데 DB 의 options
// 순서는 회차마다 다르다 — 실측 2026-09-05, `["False","True"]` 인 행이 47건 중 4건.
// 그 문항에서는 참이라고 판단해 72px 짜리 O 를 누른 학습자가 **오답 처리**된다.
// 정답 "True" 가 X 버튼에 앉아 있기 때문이다. 버튼 아래 12px 글씨가 `False · O` 라고
// 적어 두긴 했지만 기호가 그것을 압도한다. **정답을 알아도 틀리는 유일한 유형이었다.**

import { describe, expect, it } from 'vitest'

import { isTrueOption } from '../ScriptQuiz'

describe('isTrueOption — 자리가 아니라 글자로 판정한다', () => {
  it('참 쪽을 알아본다', () => {
    for (const s of ['True', 'true', '  TRUE ', '참', 'Yes']) {
      expect(isTrueOption(s)).toBe(true)
    }
  })

  it('거짓 쪽을 참으로 오인하지 않는다', () => {
    for (const s of ['False', 'false', '거짓', 'No']) {
      expect(isTrueOption(s)).toBe(false)
    }
  })

  it('뒤에 설명이 붙어도 머리글자로 판정한다 — 실제 DB 행이 그렇다', () => {
    expect(isTrueOption('False — he asks so that he himself will not rust.')).toBe(false)
    expect(isTrueOption('True — the Munchkins had never seen a dog before.')).toBe(true)
  })

  it('options 가 ["False","True"] 순서여도 O 는 True 쪽에 붙는다', () => {
    const options = ['False', 'True']
    const symbols = options.map((o) => (isTrueOption(o) ? 'O' : 'X'))
    expect(symbols).toEqual(['X', 'O'])
  })

  it('options 가 ["True","False"] 순서면 그대로 O·X', () => {
    const options = ['True', 'False']
    expect(options.map((o) => (isTrueOption(o) ? 'O' : 'X'))).toEqual(['O', 'X'])
  })

  it('알아보지 못하는 값은 X 로 두되 두 선지가 같은 기호가 되지 않는다', () => {
    const options = ['Perhaps', 'True']
    const symbols = options.map((o) => (isTrueOption(o) ? 'O' : 'X'))
    expect(new Set(symbols).size).toBe(2)
  })
})
