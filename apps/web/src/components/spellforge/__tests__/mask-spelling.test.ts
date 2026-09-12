// apps/web/src/components/spellforge/__tests__/mask-spelling.test.ts
//
// **철자를 쓰는 화면에 그 철자가 보이면 안 된다.**
//
// SpellForge 는 뜻만 보고 철자를 쓰는 모듈(L4b 시각생성)인데, 입력칸 바로 아래에 그 낱말이
// 든 원문 문장을 통째로 인쇄하고 있었다. 실측 2026-09-05 — 발행 세트의 **94.5%**,
// hub 진입 단어의 **97.7%** 가 예문에 정답 철자를 그대로 담고 있다. 저장도 렌더도 채점도
// 성공하므로 아무도 모른다. 모듈이 사실상 베껴쓰기가 된다.
//
// `blankSurface` 하나만 믿으면 안 된다 — 표면형을 못 찾으면 **문장을 그대로 돌려준다.**
// 그 조용한 폴백이 이 결함이 오래간 이유이므로, 여기서 결과까지 확인한다.

import { describe, expect, it } from 'vitest'

import { maskSpelling } from '../SpellForge'

const hidden = (s: string, w: string) => !maskSpelling(s, w).toLowerCase().includes(w.toLowerCase())

describe('maskSpelling — 정답 철자가 예문에 남지 않는다', () => {
  it('원형이 그대로 나오면 가린다', () => {
    expect(hidden('It is necessary to leave early.', 'necessary')).toBe(true)
  })

  it('규칙 굴절형도 가린다', () => {
    for (const [s, w] of [
      ['She was shining a light on it.', 'shine'],
      ['He studies every night.', 'study'],
      ['They stopped at the gate.', 'stop'],
    ] as const) {
      expect(maskSpelling(s, w).toLowerCase()).not.toContain(w.toLowerCase())
    }
  })

  it('대소문자가 달라도 가린다', () => {
    expect(hidden('Necessary steps were taken.', 'necessary')).toBe(true)
  })

  it('한 문장에 두 번 나와도 둘 다 가린다', () => {
    const out = maskSpelling('A sledge, and then another sledge, passed by.', 'sledge')
    expect(out.toLowerCase()).not.toContain('sledge')
  })

  it('낱말이 다른 낱말 안에 들어 있어도 노출을 남기지 않는다', () => {
    // 규칙이 못 잡는 자리 — 글자 그대로 치환이 받아 준다
    expect(hidden('The savoury smell of savour filled the room.', 'savour')).toBe(true)
  })

  it('예문에 그 낱말이 없으면 문장을 그대로 둔다', () => {
    const s = 'The weather being clear, a boat was hoisted out.'
    expect(maskSpelling(s, 'legible')).toBe(s)
  })

  it('정규식 특수문자가 든 표제어에서 죽지 않는다', () => {
    expect(() => maskSpelling('He said (yes) firmly.', '(yes)')).not.toThrow()
  })

  it('빈 값·짧은 값은 그대로 둔다', () => {
    expect(maskSpelling('abc', '')).toBe('abc')
    expect(maskSpelling('', 'word')).toBe('')
  })
})
