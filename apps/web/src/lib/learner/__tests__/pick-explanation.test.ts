// apps/web/src/lib/learner/__tests__/pick-explanation.test.ts
//
// 해설 키가 둘로 갈려 화면에서 사라지던 것을 막는 회귀.

import { describe, expect, it } from 'vitest'

import { pickExplanationText } from '../dcp'

describe('pickExplanationText', () => {
  it('결정론·배치 해설(explanation_ko)을 읽는다 — 순서·삽입이 이 키를 쓴다', () => {
    expect(pickExplanationText({ explanation_ko: '정답은 ④ 다.' })).toBe('정답은 ④ 다.')
  })

  it('생성형 해설(rationale_ko)도 읽는다 — 선택지 유형이 이 키를 쓴다', () => {
    expect(pickExplanationText({ rationale_ko: '글은 …라고 못 박는다.' })).toBe('글은 …라고 못 박는다.')
  })

  it('둘 다 있으면 explanation_ko 가 이긴다 — 나중에 쓴 것이다', () => {
    expect(pickExplanationText({ explanation_ko: 'A', rationale_ko: 'B' })).toBe('A')
  })

  it('빈 문자열·공백은 해설이 아니다 — 있는 척하지 않는다', () => {
    expect(pickExplanationText({ explanation_ko: '   ', rationale_ko: '' })).toBeNull()
    expect(pickExplanationText({ explanation_ko: '  ', rationale_ko: '있다' })).toBe('있다')
  })

  it('키가 없거나 문자열이 아니면 null', () => {
    expect(pickExplanationText({})).toBeNull()
    expect(pickExplanationText(null)).toBeNull()
    expect(pickExplanationText({ explanation_ko: 42 })).toBeNull()
  })
})
