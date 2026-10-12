// apps/web/src/lib/csat/inquiry/__tests__/compare-v3.test.ts
//
// v3 비교 쌍 projection — 방향 돌리기 · 상대 비공개 · stale · 쌍 없음의 서로 다른 이유
import { describe, expect, it } from 'vitest'

import { projectV3Pairs, v3PairPartners } from '../compare-v3'

const d = {
  pairs: {
    'A#1~B#2': {
      kind: 'contrast' as const,
      focus: '같은 함정처럼 보이지만 판정이 갈린다',
      left: 'A#1',
      right: 'B#2',
      types: { left: 'R-GIST', right: 'R-CLAIM' },
      mappings: [{ left: { sentences: [3] }, right: { sentences: [5], choices: [4] }, relation: '두 처방 문장이 대응한다' }],
      shared_conditions: [],
      decisive_differences: [{ text: '한쪽만 범위를 한정한다', left_sentences: [4], right_sentences: [6] }],
      principle: null,
      limitation: '두 문항 범위',
    },
  },
  items: { 'A#1': ['A#1~B#2'], 'B#2': ['A#1~B#2'] },
}
const open = () => ({ slug: 'x', label: 'X 1번' })

describe('projectV3Pairs', () => {
  it('상대 쪽에서 보면 대응 · 가르는 조건의 방향이 뒤집힌다', () => {
    const { pairs, absence } = projectV3Pairs('B#2', true, open, d)
    expect(absence).toBeNull()
    expect(pairs[0].mappings[0].self.sentences).toEqual([5])
    expect(pairs[0].mappings[0].other.sentences).toEqual([3])
    expect(pairs[0].differences[0]).toMatchObject({ selfSentences: [6], otherSentences: [4] })
  })
  it('쌍 없음 · 탐구 stale · 상대 비공개는 서로 다른 이유', () => {
    expect(projectV3Pairs('Z#9', true, open, d).absence).toBe('none')
    expect(projectV3Pairs('A#1', false, open, d)).toEqual({ pairs: [], absence: 'stale' })
    expect(projectV3Pairs('A#1', true, () => null, d)).toEqual({ pairs: [], absence: 'partner_hidden' })
  })
  it('상대는 상대 유형으로 확인한다(같은 유형 siblings 에 묶지 않음)', () => {
    expect(v3PairPartners('A#1', d)).toEqual([{ id: 'B#2', type: 'R-CLAIM' }])
  })
})
