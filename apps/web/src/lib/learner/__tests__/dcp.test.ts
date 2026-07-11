// apps/web/src/lib/learner/__tests__/dcp.test.ts
//
// DCP 순수 로직 검증 — correctOrderFromKey(정답 순서 복원) + ERROR_CAUSES 무결성.
// correctOrderFromKey 는 grade_dcp_item order 채점의 역산 — DB 실측 문항으로 대조.

import { describe, expect, it } from 'vitest'

import { correctOrderFromKey, ERROR_CAUSES } from '../dcp'

describe('correctOrderFromKey', () => {
  it('DB 실측 문항(source_order=[1,3,4,2,0]) → 정답 배열 [4,0,3,1,2]', () => {
    // grade_dcp_item standalone 검증에서 {order:[4,0,3,1,2]} = 정답으로 확인됨.
    expect(correctOrderFromKey([1, 3, 4, 2, 0])).toEqual([4, 0, 3, 1, 2])
  })

  it('항등 순서(source_order=[0,1,2]) → [0,1,2]', () => {
    expect(correctOrderFromKey([0, 1, 2])).toEqual([0, 1, 2])
  })

  it('역순(source_order=[2,1,0]) → [2,1,0]', () => {
    expect(correctOrderFromKey([2, 1, 0])).toEqual([2, 1, 0])
  })
})

describe('ERROR_CAUSES', () => {
  it('DB CHECK 5원인과 정확히 일치', () => {
    expect(ERROR_CAUSES.map((e) => e.cause)).toEqual(['vocab', 'parsing', 'structure', 'inference', 'timing'])
  })

  it('vocab 만 존재 라우트 링크(허위 링크 금지)', () => {
    const vocab = ERROR_CAUSES.find((e) => e.cause === 'vocab')
    expect(vocab?.href).toBe('/flashcard/play')
    // 나머지는 tip 만 (dead link 방지)
    for (const c of ERROR_CAUSES.filter((e) => e.cause !== 'vocab')) {
      expect(c.href).toBeNull()
      expect(c.tip.length).toBeGreaterThan(0)
    }
  })
})
