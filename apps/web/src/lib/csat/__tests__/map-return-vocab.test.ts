// apps/web/src/lib/csat/__tests__/map-return-vocab.test.ts
// T-0069 — V1 어휘 학습의 지도 복귀: 고정 내부 경로만 · 검증한 문맥만 · map_item/map_attempt 를 싣지 않는다 · 문맥 없는 일반 진입은 그대로
import { describe, expect, it } from 'vitest'

import { MAP_HOME_HREF, vocabMapReturnHref, withMapReturn } from '../map-return'

const WS = '11111111-2222-4333-8444-555555555555'
const ctx = { mapTask: 'v.core_meaning', ws: 'ws.vocab-context', mapWs: WS, mapPlan: '3', mapGoal: '7' }

describe('withMapReturn — 어휘 복습 경로', () => {
  it('/wordvault/review 에 from=map 과 검증한 문맥을 싣는다', () => {
    const u = new URL(withMapReturn('/wordvault/review', ctx), 'http://x')
    expect(u.pathname).toBe('/wordvault/review')
    expect(Object.fromEntries(u.searchParams)).toEqual({ from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: WS, map_plan: '3', map_goal: '7' })
  })
  it('어휘 활동에 자료 · 수행 id 를 지어 붙이지 않는다(넘겨도 카드가 null 로 지운다)', () => {
    const u = new URL(withMapReturn('/wordvault/review', { ...ctx, mapItem: null, mapAttempt: null }), 'http://x')
    expect(u.searchParams.has('map_item')).toBe(false)
    expect(u.searchParams.has('map_attempt')).toBe(false)
  })
  it('다른 어휘 하위 화면 · 바깥 주소는 그대로 둔다(고정 경로만)', () => {
    expect(withMapReturn('/wordvault/browse', ctx)).toBe('/wordvault/browse')
    expect(withMapReturn('/wordvault/reviewer', ctx)).toBe('/wordvault/reviewer')
    expect(withMapReturn('https://evil.example/wordvault/review', ctx)).toBe('https://evil.example/wordvault/review')
  })
})

describe('vocabMapReturnHref — 복습 화면의 「학습 지도로」', () => {
  it('from=map 이면 전체 지도 + 검증한 문맥', () => {
    const href = vocabMapReturnHref({ from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: WS, map_plan: '3', map_goal: '7' })!
    expect(href.startsWith(MAP_HOME_HREF)).toBe(true)
    const u = new URL(href, 'http://x')
    expect(u.pathname).toBe('/csat/diagnosis')
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'map', view: 'full', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: WS, map_plan: '3', map_goal: '7' })
  })
  it('문맥 없는 일반 진입 · 옛 주소 = null(일반 WordVault 동작 유지)', () => {
    expect(vocabMapReturnHref({})).toBeNull()
    expect(vocabMapReturnHref({ from: 'browse', map_task: 'v.core_meaning' })).toBeNull()
  })
  it('들어온 map_item · map_attempt 는 버리고, 형식이 틀린 값 · 주소는 싣지 않는다(열린 리디렉트 없음)', () => {
    const u = new URL(vocabMapReturnHref({ from: 'map', map_item: 'td-ind-1', map_attempt: '42', ws: 'https://evil', map_ws: 'not-a-uuid', next: '/evil' } as never)!, 'http://x')
    expect(u.pathname).toBe('/csat/diagnosis')
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'map', view: 'full' })
  })
})
