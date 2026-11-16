// apps/web/src/lib/csat/authored/__tests__/learn-return.test.ts
import { describe, expect, it } from 'vitest'

import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { MAP_HOME_HREF } from '@/lib/csat/map-return'
import { learnReturnHref, learnSelfHref } from '../learn-return'

const D = '0b6f3a2e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const WS = '11111111-2222-4333-8444-555555555555'
const fromMap = { from: 'map', map_ws: WS, map_plan: '3', d: D }

describe('learnReturnHref — 안내 · 기록 실패 링크', () => {
  it('지도에서 왔으면 from=map 과 위치 · 이 자료를 싣는다', () => {
    const h = learnReturnHref('r5-cm-ind-3', fromMap)
    expect(h.startsWith(MAP_HOME_HREF)).toBe(true)
    expect(h).toContain(`map_ws=${WS}`)
    expect(h).toContain('map_plan=3')
    expect(h).toContain('map_item=r5-cm-ind-3')
  })
  it('위치가 없으면 예전과 같은 전체 지도', () => {
    expect(learnReturnHref('r5-cm-ind-3', {})).toBe(MAP_HOME_HREF)
    expect(learnReturnHref('r5-cm-ind-3', { map_ws: WS })).toBe(MAP_HOME_HREF)
  })
  it('형식이 틀리거나 외부 주소인 위치 값은 버린다', () => {
    const h = learnReturnHref('r5-cm-ind-3', { from: 'map', map_ws: 'https://evil.example', map_plan: 'x', step: '//evil' })
    expect(h).not.toMatch(/evil|map_ws|map_plan|step=/)
    expect(h.startsWith(MAP_HOME_HREF)).toBe(true)
  })
})

describe('learnSelfHref — 로그인 복귀 · 묶음 선택', () => {
  it('로그인 next 가 납품 id 와 지도 위치를 지킨다', () => {
    const login = loginUrlWithReturn(learnSelfHref('r5-cm-ind-3', fromMap, D))
    const next = decodeURIComponent(login.split('=').slice(1).join('='))
    expect(next).toContain(`/csat/learn/r5-cm-ind-3?d=${D}`)
    expect(next).toContain('from=map')
    expect(next).toContain(`map_ws=${WS}`)
  })
  it('묶음 선택 링크도 위치를 싣는다', () => {
    const h = learnSelfHref('r5-cm-ind-3', { from: 'map', map_ws: WS }, D)
    expect(h).toContain(`d=${D}`)
    expect(h).toContain('from=map')
  })
  it('지도 출발이 아니면 예전 주소 · 틀린 납품 id 는 뺀다', () => {
    expect(learnSelfHref('r5-cm-ind-3', {}, D)).toBe(`/csat/learn/r5-cm-ind-3?d=${D}`)
    expect(learnSelfHref('r5-cm-ind-3', {}, 'bad')).toBe('/csat/learn/r5-cm-ind-3')
  })
})
