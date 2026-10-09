// apps/web/src/lib/knowledge/__tests__/research-compare.test.ts
// 작업 4 — 근거 종류를 합치지 않는다 · 충돌 · 연구 근거 판정 · 영역 지도 공백
import { describe, expect, it } from 'vitest'

import { bucketOf, comparePrinciple, domainMatrix, principleGaps, type REvidence, type RItem } from '../research-compare'

const item: RItem = { id: 'p', slug: 'p', title: 'P', layer: 'principle', status: 'adopted', skillIds: ['skill:logic'] }
const ev = (x: Partial<REvidence>): REvidence => ({ itemId: 'p', attribution: 'stated', evidenceLevel: null, applicability: null, applicabilityNote: null, researchSourceId: null, ...x })

describe('근거 종류', () => {
  it('연구는 설계 수준 + 서지 연결이 있어야 연구다', () => {
    expect(bucketOf(ev({ evidenceLevel: 'rct', researchSourceId: 's' }))).toBe('research')
    expect(bucketOf(ev({ evidenceLevel: 'rct' }))).toBe('unrated')
    expect(bucketOf(ev({ evidenceLevel: 'practitioner_claim' }))).toBe('practitioner')
    expect(bucketOf(ev({ evidenceLevel: 'expert_opinion' }))).toBe('expert')
    expect(bucketOf(ev({ evidenceLevel: 'exam_observation', attribution: 'observed' }))).toBe('exam')
    expect(bucketOf(ev({ attribution: 'inferred' }))).toBe('inferred')
  })
  it('강사 주장이 많아도 연구 근거로 판정하지 않는다', () => {
    const c = comparePrinciple(item, Array.from({ length: 99 }, () => ev({ evidenceLevel: 'practitioner_claim' })), [])
    expect(c.standing).toBe('observation_only')
    expect(c.buckets.practitioner).toBe(99)
    expect(c.buckets.research).toBe(0)
    expect(c.gaps.join(' ')).toMatch(/연구 근거 없음/)
  })
  it('연구 + 적용 가능 → 연구 근거 있음 · 반대 설명이 붙으면 충돌', () => {
    const r = [ev({ evidenceLevel: 'quasi_experimental', researchSourceId: 's', applicability: 'partial', applicabilityNote: 'EFL 고등학생 · 논증 지문' })]
    expect(comparePrinciple(item, r, []).standing).toBe('research_backed')
    expect(comparePrinciple(item, r, []).conditions).toEqual(['EFL 고등학생 · 논증 지문'])
    expect(comparePrinciple(item, r, [{ itemId: 'p', inquiryId: 'q', role: 'counter' }]).standing).toBe('contested')
  })
})

describe('영역 지도', () => {
  it('원리 층이 빈 영역을 찾는다', () => {
    const items: RItem[] = [item, { ...item, id: 'm', layer: 'method', skillIds: ['skill:listening'] }]
    const m = domainMatrix(items)
    expect(m['skill:logic'].principle).toEqual({ total: 1, adopted: 1 })
    expect(principleGaps(m)).toContain('skill:listening')
    expect(principleGaps(m)).not.toContain('skill:logic')
  })
})

describe('연구 있음 · 적용 적합성 낮음', () => {
  it('연구 근거가 있으면 적합성이 낮아도 「관찰·주장뿐」으로 보이지 않는다', () => {
    const c = comparePrinciple(item, [ev({ evidenceLevel: 'rct', researchSourceId: 's', applicability: 'low' })], [])
    expect(c.standing).toBe('research_low_fit')
  })
})
