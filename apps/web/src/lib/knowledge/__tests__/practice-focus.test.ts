// apps/web/src/lib/knowledge/__tests__/practice-focus.test.ts
// 오류 초점별 개입 — 초점마다 방법 · 강조 · 피드백이 다르다
import { describe, expect, it } from 'vitest'

import { FOCUSES, FOCUS_GUIDE, focusFeedback, isFocus } from '../practice-focus'

const base = { claimHit: true, claimSentences: [4], mySupport: [5], supportSentences: [2, 5], supportOk: false, relationOk: false, relation: 'reason' as const, myRelation: 'example' as const }

describe('초점별 개입', () => {
  it('세 초점의 방법 · 강조 단계가 서로 다르다', () => {
    const methods = new Set(FOCUSES.map((f) => FOCUS_GUIDE[f].method.join('|')))
    expect(methods.size).toBe(3)
    expect(FOCUSES.map((f) => FOCUS_GUIDE[f].emphasis)).toEqual(['claim', 'support', 'relation'])
  })
  it('근거 초점 피드백은 빠뜨린 문장을 짚는다', () => {
    expect(focusFeedback('support', base).join(' ')).toMatch(/빠뜨린 근거: 문장 3/)
  })
  it('주장 초점 피드백은 정답 주장과 다시 볼 질문을 준다', () => {
    expect(focusFeedback('claim', { ...base, claimHit: false }).join(' ')).toMatch(/주장은 문장 5/)
  })
  it('관계 초점 피드백은 고른 관계와 정답 관계를 대비한다', () => {
    const t = focusFeedback('relation', base).join(' ')
    expect(t).toMatch(/이유/)
    expect(t).toMatch(/예를 들어/)
  })
  it('알 수 없는 초점은 받지 않는다', () => {
    expect(isFocus('support')).toBe(true)
    expect(isFocus('vocab')).toBe(false)
  })
})
