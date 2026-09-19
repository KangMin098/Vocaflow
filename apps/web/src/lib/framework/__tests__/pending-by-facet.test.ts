// apps/web/src/lib/framework/__tests__/pending-by-facet.test.ts
//
// `/practice` 「오늘의 연습지」(2026-09-19 · DD-32) — 면마다 아직 통과하지 못한 낱말.
//   ① 통과한 낱말은 그 면의 문항에서 빠진다
//   ② 시도했는데 못 넘은 낱말(정답률 낮은 순)이 아직 시도하지 않은 낱말보다 먼저
//   ③ 면당 상한

import { describe, expect, it } from 'vitest'

import type { WordFrameworkState } from '../flow'
import { pendingByFacet } from '../word-progress'

function s(word: string, over: Partial<WordFrameworkState> = {}): WordFrameworkState {
  return { word, passed: [], accuracy: {}, hits: {}, memory: 'new', encounters: 0, ...over }
}

describe('pendingByFacet', () => {
  const states = [
    s('alpha', { passed: ['recognize'], accuracy: { recognize: 1 } }),
    s('bravo', { accuracy: { recognize: 0.6 } }),
    s('charlie', { accuracy: { recognize: 0.2 } }),
    s('delta'),
  ]

  it('통과한 낱말은 빠지고, 못 넘은 낱말이 정답률 낮은 순으로 먼저', () => {
    expect(pendingByFacet(states).recognize).toEqual(['charlie', 'bravo', 'delta'])
  })

  it('시도가 없는 면은 입력 순', () => {
    expect(pendingByFacet(states).spell).toEqual(['alpha', 'bravo', 'charlie', 'delta'])
  })

  it('면당 상한', () => {
    expect(pendingByFacet(states, 2).spell).toHaveLength(2)
  })
})
