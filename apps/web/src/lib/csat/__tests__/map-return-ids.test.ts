// apps/web/src/lib/csat/__tests__/map-return-ids.test.ts — 지도 복귀 문맥의 Workspace UUID · 버전 · 쿼리 추출(형식 검증만 · 조회 권한 아님)
import { describe, expect, it } from 'vitest'

import { mapReturnQuery, parseMapReturn, parseMapUuid, parseMapVersion, returnQueryOf } from '../map-return'

const WS = '7eb50a7c-0245-4951-bf42-67bf8231fa79'

describe('parseMapUuid — 소문자 16진 UUID 만', () => {
  it('정상 · 대문자 · 길이 틀림 · 주입 문자열 · 빈 값', () => {
    expect(parseMapUuid(WS)).toBe(WS)
    expect(parseMapUuid(WS.toUpperCase())).toBeNull()
    expect(parseMapUuid(WS.slice(0, -1))).toBeNull()
    expect(parseMapUuid(`${WS}&x=1`)).toBeNull()
    expect(parseMapUuid('')).toBeNull()
    expect(parseMapUuid(null)).toBeNull()
    expect(parseMapUuid(undefined)).toBeNull()
  })
})

describe('parseMapVersion — 1 이상 정수 9자리 이하만', () => {
  it('경계', () => {
    expect(parseMapVersion('1')).toBe('1')
    expect(parseMapVersion('999999999')).toBe('999999999')
    expect(parseMapVersion('1000000000')).toBeNull()
    expect(parseMapVersion('0')).toBeNull()
    expect(parseMapVersion('01')).toBeNull()
    expect(parseMapVersion('-1')).toBeNull()
    expect(parseMapVersion('1.5')).toBeNull()
    expect(parseMapVersion(undefined)).toBeNull()
  })
})

describe('returnQueryOf — 복귀 문맥 키만 · 배열은 첫 값', () => {
  it('다른 키는 버리고 배열은 첫 값만 · 검증은 parseMapReturn 이 한다', () => {
    const q = returnQueryOf({ map_ws: [WS, 'other'], map_plan: '3', map_goal: '0', d: 'x', step: 'nope' })
    expect(q).toMatchObject({ map_ws: WS, map_plan: '3', map_goal: '0', step: 'nope' })
    expect('d' in q).toBe(false)
    const ctx = parseMapReturn(q)
    expect(ctx).toMatchObject({ mapWs: WS, mapPlan: '3', mapGoal: null, step: null })
    expect(mapReturnQuery(ctx)).toBe(`&map_ws=${WS}&map_plan=3`)
  })
})
