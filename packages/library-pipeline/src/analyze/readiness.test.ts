// packages/library-pipeline/src/analyze/readiness.test.ts
//
// 조용한 저하를 막는 판단이 **한 곳에** 있는지.
// 실측 2026-08-19: 키 없이 처리하면 사전 적중이 95.2% → 72~75% 로 떨어지는데,
// CEFR 신뢰도·어휘 밀도는 거의 안 변해 겉으로는 정상으로 보였다.

import { describe, expect, it } from 'vitest'

import { DEGRADED_DICTIONARY_HIT, checkAnalysisReadiness } from './readiness'

describe('checkAnalysisReadiness', () => {
  it('키가 있으면 통과하고 사유를 남기지 않는다', () => {
    const r = checkAnalysisReadiness({ ANTHROPIC_API_KEY: 'sk-test' })
    expect(r.ready).toBe(true)
    expect(r.reason).toBeNull()
  })

  it('키가 없으면 막고, 무엇이 나빠지는지 숫자로 말한다', () => {
    const r = checkAnalysisReadiness({})
    expect(r.ready).toBe(false)
    // "설정되지 않았습니다" 만으로는 아무도 안 멈춘다 — 결과를 말해야 한다.
    expect(r.reason).toContain('사전 적중률')
    expect(r.reason).toContain('95%')
    expect(r.reason).toContain('72%')
  })

  it('겉으로 정상으로 보인다는 것을 사유에 적는다', () => {
    // 이 결함의 핵심이다. 이 문장이 없으면 다음 사람은 CEFR 신뢰도만 보고 넘어간다.
    expect(checkAnalysisReadiness({}).reason).toContain('겉으로는 정상으로 보인다')
  })

  it('빈 문자열도 없는 것으로 본다 — 키가 있는 척하는 값이 더 위험하다', () => {
    expect(checkAnalysisReadiness({ ANTHROPIC_API_KEY: '' }).ready).toBe(false)
  })

  it('실측 수치는 0~1 범위이고 키 있는 쪽이 더 높다', () => {
    const { withKey, withoutKey } = DEGRADED_DICTIONARY_HIT
    expect(withKey).toBeGreaterThan(withoutKey)
    for (const v of [withKey, withoutKey]) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('환경변수를 주입받는다 — 테스트가 실제 환경을 건드리지 않는다', () => {
    expect(checkAnalysisReadiness({ ANTHROPIC_API_KEY: 'x' }).ready).toBe(true)
    expect(checkAnalysisReadiness({ OTHER: 'x' }).ready).toBe(false)
  })
})
