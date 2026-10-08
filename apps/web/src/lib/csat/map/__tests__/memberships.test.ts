// apps/web/src/lib/csat/map/__tests__/memberships.test.ts

import { describe, expect, it } from 'vitest'

import { lineItemKeys, type MembershipInput } from '../memberships'
import type { RefItem } from '../target'

const items = (examId: string): RefItem[] => Array.from({ length: 45 }, (_, i) => ({ examId, no: i + 1, points: 2, errorRate: null }))

function input(over: Partial<MembershipInput> = {}): MembershipInput {
  return {
    lineCodes: new Set(['A1', 'A7', 'B1', 'B6', 'C1', 'C8', 'D1']),
    exams: [{ id: 'E', items: items('E') }],
    metaByKey: { 'E#30': { itemId: 'i30', typeId: 'R-GIST' }, 'E#31': { itemId: 'i31', typeId: 'R-TITLE' } },
    attributesByItem: { i30: ['A1'], i31: ['A1', 'A9'] }, // A9 는 라인 노드에 없다
    trapFamiliesByItem: { i30: ['C1', 'C9'], i31: ['C1'] }, // C9 는 라인 노드에 없다
    byType: { 'R-GIST': 'B6', 'R-TITLE': 'B6' },
    byNo: { 'E#1': 'B1', 'E#2': 'B1' },
    listening: { attribute: 'A7', weight: 2, toNo: 17 },
    ...over,
  }
}

describe('lineItemKeys', () => {
  it('독해 문항: 역량 · 유형 · 함정 계열로 이어지고, 지도에 없는 코드(A9 · C9)는 버린다', () => {
    const r = lineItemKeys(input())
    expect(r.A1?.sort()).toEqual(['E#30', 'E#31'])
    expect(r.B6?.sort()).toEqual(['E#30', 'E#31'])
    expect(r.C1?.sort()).toEqual(['E#30', 'E#31'])
    expect(r.A9).toBeUndefined()
    expect(r.C9).toBeUndefined()
  })

  it('듣기(문항 메타 없음): 설정이 가리키는 역량 + 승인된 번호표 라인. 1~to_no 밖은 안 간다', () => {
    const r = lineItemKeys(input())
    expect(r.A7).toHaveLength(17)
    expect(r.A7).toContain('E#1')
    expect(r.A7).not.toContain('E#18')
    expect(r.B1?.sort()).toEqual(['E#1', 'E#2'])
  })

  it('듣기 가중치가 0이면 어떤 역량에도 연결하지 않는다', () => {
    expect(lineItemKeys(input({ listening: { attribute: 'A7', weight: 0, toNo: 17 } })).A7).toBeUndefined()
  })

  it('설정이 가리키는 역량이 바뀌면(A3) 그 라인으로 간다', () => {
    const r = lineItemKeys(input({ lineCodes: new Set(['A3', 'A7']), listening: { attribute: 'A3', weight: 1, toNo: 5 } }))
    expect(r.A3).toHaveLength(5)
    expect(r.A7).toBeUndefined()
  })

  it('to_no 가 독해 번호를 포함해도 문항 메타가 있는 독해 문항은 듣기로 가지 않는다', () => {
    const r = lineItemKeys(input({ listening: { attribute: 'A7', weight: 2, toNo: 45 } }))
    expect(r.A7).not.toContain('E#30')
    expect(r.A7).toContain('E#29') // 메타 없는 번호는 듣기로 센다(엔진과 같은 규칙)
  })

  it('번호표가 없는 회차의 듣기 번호는 B 라인에 안 간다', () => {
    const r = lineItemKeys(input({ exams: [{ id: 'F', items: items('F') }], metaByKey: {} }))
    expect(r.B1).toBeUndefined()
  })

  it('D 라인은 문항과 연결되지 않는다', () => {
    expect(lineItemKeys(input()).D1).toBeUndefined()
  })
})
