// apps/web/src/lib/csat/map/__tests__/payload.test.ts

import { describe, expect, it } from 'vitest'

import { parseGoal, parseTaskId } from '../payload'

describe('parseGoal', () => {
  it('0~100 정수만 받는다', () => {
    expect(parseGoal({ target: 100 })).toBe(100)
    expect(parseGoal({ target: 0 })).toBe(0)
    expect(parseGoal({ target: 87 })).toBe(87)
  })
  it('범위 밖 · 소수 · 문자열 · 본문 없음은 거절', () => {
    for (const b of [{ target: 101 }, { target: -1 }, { target: 90.5 }, { target: '90' }, { target: null }, {}, null, 'x', 90]) {
      expect(parseGoal(b)).toBeNull()
    }
  })
})

describe('parseTaskId', () => {
  it('라인 코드-순번 형태만 받는다', () => {
    for (const id of ['A1-1', 'B10-3', 'C8-3', 'J5-2']) expect(parseTaskId(id)).toBe(id)
  })
  it('그 밖은 거절(주입 · 다른 형태)', () => {
    for (const id of ['', 'A1', 'K1-1', 'a1-1', "A1-1'; drop", '../A1-1', 'A100-1', 'A1-100']) expect(parseTaskId(id)).toBeNull()
  })
})
