// apps/web/src/lib/csat/__tests__/home-suggestion.test.ts
//
// 지도 홈 첫 제안 — UX §7 우선순위 · 오류를 기록 0 으로 삼키지 않음 · 초점 매핑 · 복귀 문맥 검증
import { describe, expect, it } from 'vitest'

import { focusSuggestion, parseHomeReturn, pickHomeSuggestion } from '../home-suggestion'

const base = { map: 'ok' as const, focusKind: 'step' as const, returned: false, activeSet: false }

describe('pickHomeSuggestion — 우선순위', () => {
  it('오류가 가장 먼저 — 복귀 · 진행 중 세트가 있어도', () => {
    expect(pickHomeSuggestion({ ...base, map: 'error', returned: true, activeSet: true })).toBe('error')
  })
  it('복귀 → 진행 중 세트 → 지도 초점 순', () => {
    expect(pickHomeSuggestion({ ...base, returned: true, activeSet: true })).toBe('return')
    expect(pickHomeSuggestion({ ...base, activeSet: true })).toBe('resume')
    expect(pickHomeSuggestion(base)).toBe('check')
  })
  it('지도 준비 중은 오류가 아니다 — 진행 중 세트가 있으면 이어서가 먼저', () => {
    expect(pickHomeSuggestion({ ...base, map: 'preparing', focusKind: null })).toBe('preparing')
    expect(pickHomeSuggestion({ ...base, map: 'preparing', focusKind: null, activeSet: true })).toBe('resume')
  })
  it('기기 기록을 아직 못 읽었으면(null) 이어서를 주장하지 않는다', () => {
    expect(pickHomeSuggestion({ ...base, activeSet: null })).toBe('check')
  })
})

describe('focusSuggestion — 지도 초점 그대로', () => {
  it('확인 필요 · 기록 없음 · 기록만', () => {
    for (const k of ['step', 'distinguish', 'direct'] as const) expect(focusSuggestion(k)).toBe('check')
    expect(focusSuggestion('record')).toBe('no_records')
    for (const k of ['more', 'pending', 'none'] as const) expect(focusSuggestion(k)).toBe('records_only')
    expect(focusSuggestion(null)).toBe('preparing')
    // 목표 미설정 — 지도 초점 카드가 「목표 정하기」 를 먼저 보인다
    expect(focusSuggestion('goal')).toBe('goal')
  })
})

describe('parseHomeReturn — 문항 slug 형식만', () => {
  it('허용', () => {
    for (const s of ['2026-34', '2014A-31', 'M2309-36', 'H2603G3-34']) expect(parseHomeReturn('item', s)).toBe(s)
  })
  it('거부 — from 없음 · 자유 문자열 · 외부 주소 · 경로', () => {
    expect(parseHomeReturn(undefined, '2026-34')).toBeNull()
    expect(parseHomeReturn('item', 'https://evil.example/x')).toBeNull()
    expect(parseHomeReturn('item', '../admin')).toBeNull()
    expect(parseHomeReturn('item', '2026-34&x=1')).toBeNull()
    expect(parseHomeReturn('map', '2026-34')).toBeNull()
  })
})
