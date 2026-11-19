// apps/web/src/lib/csat/judgment/__tests__/pilot.test.ts
// U02-ORDER-PILOT-01 — 판단 도구 범위 판정: 'first' 유형은 전체, 그 밖은 파일럿 한 문항 · 고정 판본만.
import { describe, expect, it } from 'vitest'

import { FIRST_JUDGMENT_TYPES, JUDGMENT_PILOTS, judgmentBindingInScope, judgmentToolInScope } from '../pilot'

const P = JUDGMENT_PILOTS[0]
const V = { unitsVersion: P.unitsVersion, unitsHash: P.unitsHash, analysisVersion: P.analysisVersion }

describe('judgmentToolInScope', () => {
  it('R-IRRELEVANT 는 어느 문항이든(기존 first)', () => {
    expect(judgmentToolInScope('R-IRRELEVANT', 'X#1')).toBe(true)
  })
  it('R-ORDER 는 파일럿 문항만', () => {
    expect(judgmentToolInScope('R-ORDER', 'H2609G2#36')).toBe(true)
    expect(judgmentToolInScope('R-ORDER', 'H2609G2#37')).toBe(false)
    expect(judgmentToolInScope('R-ORDER', '2014A#36')).toBe(false)
  })
  it('파일럿 id 라도 다른 유형 · 빈 값은 아니다', () => {
    expect(judgmentToolInScope('R-SUMMARY', 'H2609G2#36')).toBe(false)
    expect(judgmentToolInScope(null, 'H2609G2#36')).toBe(false)
    expect(judgmentToolInScope('R-ORDER', '')).toBe(false)
  })
  it('R-ORDER 는 전역 first 집합에 없다', () => {
    expect(FIRST_JUDGMENT_TYPES.has('R-ORDER')).toBe(false)
    expect([...FIRST_JUDGMENT_TYPES]).toEqual(['R-IRRELEVANT'])
    expect(JUDGMENT_PILOTS).toHaveLength(1)
  })
})

describe('judgmentBindingInScope', () => {
  const item = (o: Partial<typeof V> = {}, id = P.itemId, typeId = P.typeId) => ({ id, typeId, version: { ...V, ...o } })
  it('고정 판본 · 원문 해시 일치 → 참', () => {
    expect(judgmentBindingInScope(item(), P.inputHash)).toBe(true)
    expect(judgmentBindingInScope(item(), null)).toBe(true)
  })
  it('원문 해시 · units 판본 · units 해시 · 분석 판본 하나라도 다르면 거짓', () => {
    expect(judgmentBindingInScope(item(), 'e'.repeat(64))).toBe(false)
    expect(judgmentBindingInScope(item({ unitsVersion: 2 }), null)).toBe(false)
    expect(judgmentBindingInScope(item({ unitsHash: 'f'.repeat(64) }), null)).toBe(false)
    expect(judgmentBindingInScope(item({ analysisVersion: 2 }), null)).toBe(false)
  })
  it('파일럿 밖 R-ORDER 는 판본이 같아도 거짓 · R-IRRELEVANT 는 기존 결속만(참)', () => {
    expect(judgmentBindingInScope(item({}, 'H2609G2#37'), null)).toBe(false)
    expect(judgmentBindingInScope({ id: 'X#1', typeId: 'R-IRRELEVANT', version: { unitsVersion: 9, unitsHash: 'z', analysisVersion: 9 } }, 'q')).toBe(true)
  })
})
