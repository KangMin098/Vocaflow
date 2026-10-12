// apps/web/src/lib/csat/inquiry/__tests__/compare-v3.test.ts
//
// v3 비교 쌍 projection — 방향 돌리기 · 상대 비공개 · stale · 쌍 없음의 서로 다른 이유
import { describe, expect, it } from 'vitest'

import published from '../../compare-v3-data.json'

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
  it('실제 공개 정본의 모든 상대가 유형으로 조회되고 양쪽 방향에서 projection된다', () => {
    const ids = Object.keys(published.items)
    expect(ids.length).toBeGreaterThan(0)
    for (const itemId of ids) {
      const partners = v3PairPartners(itemId)
      // item route는 이 유형 집합으로 공개 목록을 조회한다. null만 있으면 749쌍도 하나도 못 보인다.
      const types = new Set(partners.map((p) => p.type).filter(Boolean))
      expect(types.size, `${itemId}의 상대 유형`).toBeGreaterThan(0)
      const openIds = new Set(partners.filter((p) => p.type && types.has(p.type)).map((p) => p.id))
      const projected = projectV3Pairs(itemId, true, (id) => openIds.has(id) ? { slug: id, label: id } : null)
      expect(projected.absence, itemId).toBeNull()
      expect(projected.pairs, itemId).toHaveLength(published.items[itemId as keyof typeof published.items].length)
    }
  })

  it('상대 쪽에서 보면 대응 · 가르는 조건의 방향이 뒤집힌다', () => {
    const { pairs, absence } = projectV3Pairs('B#2', true, open, d)
    expect(absence).toBeNull()
    expect(pairs[0].mappings[0].self.sentences).toEqual([5])
    expect(pairs[0].mappings[0].other.sentences).toEqual([3])
    expect(pairs[0].differences[0]).toMatchObject({ selfSentences: [6], otherSentences: [4] })
  })
  it('쌍 없음 · 탐구 stale · 상대 비공개는 서로 다른 이유', () => {
    expect(projectV3Pairs('Z#9', true, open, d).absence).toBe('none')
    expect(projectV3Pairs('A#1', false, open, d)).toMatchObject({ pairs: [], absence: 'stale' })
    expect(projectV3Pairs('A#1', true, () => null, d)).toMatchObject({ pairs: [], absence: 'partner_hidden' })
  })
  it('상대는 상대 유형으로 확인한다(같은 유형 siblings 에 묶지 않음)', () => {
    expect(v3PairPartners('A#1', d)).toEqual([{ id: 'B#2', type: 'R-CLAIM' }])
  })
})

describe('상대 상태 구별 · 실제 공개 정본 결속(M5)', () => {
  it('보류 · 골격에 없음 · 분석 바뀜을 따로 세고, 남은 쌍이 없으면 서로 다른 이유를 낸다', () => {
    const held = projectV3Pairs('A#1', true, () => ({ state: 'held' }), d)
    expect(held).toMatchObject({ absence: 'partner_hidden', withheld: { held: 1, missing: 0, changed: 0 } })
    expect(projectV3Pairs('A#1', true, () => ({ state: 'missing' }), d)).toMatchObject({ absence: 'partner_missing', withheld: { missing: 1 } })
    const bound = { ...d, pairs: { 'A#1~B#2': { ...d.pairs['A#1~B#2'], binding: { left: { units_hash: 'ua' }, right: { units_hash: 'ub' } } } } }
    expect(projectV3Pairs('A#1', true, open, bound, () => 'ub-new')).toMatchObject({ absence: 'partner_changed', withheld: { changed: 1 } })
    expect(projectV3Pairs('A#1', true, open, bound, () => 'ub').pairs).toHaveLength(1)
    expect(projectV3Pairs('A#1', true, open, bound, () => null)).toMatchObject({ absence: 'partner_changed' })
  })

  it('실제 공개 정본: 모든 쌍의 상대 문장 분할이 지금 공개 탐구와 같다(빌드 ↔ 탐구 정본 일치)', async () => {
    const { inquiryUnitsHash } = await import('../data')
    let total = 0
    for (const itemId of Object.keys(published.items)) {
      const r = projectV3Pairs(itemId, true, (id) => ({ state: 'open', slug: id, label: id }), undefined, inquiryUnitsHash)
      expect(r.withheld, itemId).toEqual({ held: 0, missing: 0, changed: 0 })
      total += r.pairs.length
    }
    // 쌍 하나가 양쪽 문항에 한 번씩 보인다
    expect(total).toBe(Object.keys(published.pairs).length * 2)
  })
})
