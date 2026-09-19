// apps/web/src/app/(auth)/signup/__tests__/SignupProof.test.ts
//
// 모바일 두 줄 칠의 자르기 규칙 — 칠이 반드시 두 줄 안에 들어와야 한다(2026-09-19 2회차 수정 · DD-26).

import { describe, expect, it } from 'vitest'

import { isUnknownAt } from '@/lib/textfit/paint'

import { fromFirstUnknown } from '../SignupProof'

const T = (s: string, v?: number | null) => (v === undefined ? { t: s } : { t: s, v })
const TOKENS = [
  T('Every', 1), T(' '), T('reader', 2), T(' '), T('encounters', 5), T(' '), T('the'), T(' '),
  T('same', 1), T(' '), T('page', 1), T('. '), T('It', undefined), T(' '), T('demands', 4), T(' '),
  T('to'), T(' '), T('be'), T(' '), T('decoded', 8), T('.'),
]

describe('fromFirstUnknown', () => {
  it('처음 만나는 낱말 앞 네 낱말부터 — 말줄임표로 시작한다', () => {
    const out = fromFirstUnknown(TOKENS, 6)
    expect(out[0].t).toBe('… ')
    const text = out.map((t) => t.t).join('')
    expect(text).toBe('… It demands to be decoded.')
    // 칠할 낱말이 잘린 창 안에 있다
    expect(out.some((t) => isUnknownAt(t, 6))).toBe(true)
  })

  it('첫 칠 낱말이 앞쪽이면 자르지 않는다', () => {
    const out = fromFirstUnknown(TOKENS, 4)
    expect(out).toEqual(TOKENS)
  })

  it('칠할 낱말이 없으면 그대로', () => {
    expect(fromFirstUnknown(TOKENS, 10)).toEqual(TOKENS)
  })
})
