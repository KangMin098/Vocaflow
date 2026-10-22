// apps/web/src/lib/csat/__tests__/map-return-vocab.test.ts
// T-0069 — V1 어휘 학습의 지도 복귀: 고정 내부 경로만 · 검증한 문맥만 · map_item/map_attempt 를 싣지 않는다 · 문맥 없는 일반 진입은 그대로
import { describe, expect, it } from 'vitest'

import { MAP_HOME_HREF, VOCAB_PATHS, vocabMapLink, vocabMapReturnHref, withMapReturn } from '../map-return'

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
    // T-0086: /wordvault/browse 는 이제 허용(아래 T-0086 블록) — 그 밖의 하위 화면은 그대로
    expect(withMapReturn('/wordvault/study', ctx)).toBe('/wordvault/study')
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

// ── T-0086 — 어휘 준비(목록) ↔ 복습 왕복 ──
const sp = { from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: '11111111-2222-4333-8444-555555555555', map_plan: '3', map_goal: '7' }
const q = (h: string) => new URL(h, 'http://x').searchParams

describe('어휘 경로 허용(T-0086)', () => {
  it('정확한 두 경로만 — browse · review 는 문맥을 싣고, 다른 /wordvault/* · 외부 · factory 외 경로는 그대로', () => {
    expect(VOCAB_PATHS).toEqual(['/wordvault/review', '/wordvault/browse'])
    const ctx = { mapTask: 'v.core_meaning', ws: 'ws.vocab-context' }
    expect(q(withMapReturn('/wordvault/browse', ctx)).get('map_task')).toBe('v.core_meaning')
    expect(q(withMapReturn('/wordvault/browse?filter=state:new', ctx)).get('filter')).toBe('state:new')
    for (const h of ['/wordvault', '/wordvault/study', '/wordvault/browsex', 'https://evil.example/wordvault/browse', '/practice']) expect(withMapReturn(h, ctx)).toBe(h)
    expect(q(withMapReturn('/csat/factory/x', ctx)).get('from')).toBe('map') // main 의 factory 지원 보존
  })
  it('vocabMapLink — 복귀 주소의 문맥을 다시 검증해 싣는다 · 일반 진입(null)은 경로 그대로', () => {
    const back = vocabMapReturnHref(sp)!
    const b = q(vocabMapLink('/wordvault/browse', back))
    expect(Object.fromEntries(['from', 'map_task', 'ws', 'map_ws', 'map_plan', 'map_goal'].map((k) => [k, b.get(k)]))).toEqual(sp)
    expect(vocabMapLink('/wordvault/review', back).startsWith('/wordvault/review?')).toBe(true)
    expect(vocabMapLink('/wordvault/browse', null)).toBe('/wordvault/browse')
  })
  it('stale map_item · map_attempt 는 어느 링크에도 남지 않는다', () => {
    const back = vocabMapReturnHref({ ...sp, map_item: 'authored:x', map_attempt: '42' })!
    for (const h of [back, vocabMapLink('/wordvault/browse', back), vocabMapLink('/wordvault/review', back)]) {
      expect(q(h).has('map_item')).toBe(false)
      expect(q(h).has('map_attempt')).toBe(false)
    }
  })
  it('불량 문맥은 버리고(추정 없음) from=map 아니면 복귀 없음', () => {
    const back = vocabMapReturnHref({ from: 'map', map_task: 'DROP TABLE', ws: '../x', map_ws: 'not-uuid', map_goal: 'abc' })!
    const b = q(vocabMapLink('/wordvault/browse', back))
    expect(b.get('from')).toBe('map')
    for (const k of ['map_task', 'ws', 'map_ws', 'map_goal']) expect(b.has(k)).toBe(false)
    expect(vocabMapReturnHref({ map_task: 'v.core_meaning' })).toBeNull()
    expect(vocabMapReturnHref({ from: 'https://evil.example' })).toBeNull()
  })
})
