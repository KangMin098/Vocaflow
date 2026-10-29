// apps/web/src/components/dictation/__tests__/result-auth-epoch.test.ts
// T-0254 리뷰 P1 — 결과 조회의 인증 세대: 신원이 바뀔 때마다 단조 증가(A→B→A 도 다른 세대), 시작 때 세대와 정확히 같을 때만 응답을 받는다.
import { describe, expect, it } from 'vitest'

import { ResultAuthEpoch, acceptsAtEpoch } from '../result-auth-epoch'

describe('ResultAuthEpoch', () => {
  it('첫 관측은 기준선 — 세대를 올리지 않는다 · 같은 사람의 토큰 갱신도 그대로', () => {
    const e = new ResultAuthEpoch()
    expect(e.observe({ event: 'INITIAL_SESSION', userId: 'A' })).toBe(false)
    expect(e.observe({ event: 'TOKEN_REFRESHED', userId: 'A' })).toBe(false)
    expect(e.baseline('A')).toBe(false)
    expect(e.gen).toBe(0)
  })
  it('r3 리뷰 P2 — 이벤트를 받은 뒤 늦게 온 초기값(A)은 최신(B)을 덮지 않는다 · 그 뒤 B→A 는 세대 증가', () => {
    const e = new ResultAuthEpoch()
    e.observe({ event: 'SIGNED_IN', userId: 'B' })
    expect(e.baseline('A')).toBe(false)
    expect(e.gen).toBe(0)
    expect(e.observe({ event: 'SIGNED_IN', userId: 'A' })).toBe(true)
    expect(e.gen).toBe(1)
  })
  it('이벤트가 아직 없으면 초기값이 기준선 — 그 뒤 다른 계정은 세대 증가', () => {
    const e = new ResultAuthEpoch()
    expect(e.baseline('A')).toBe(false)
    expect(e.observe({ event: 'SIGNED_IN', userId: 'B' })).toBe(true)
    expect(e.gen).toBe(1)
  })
  it('A→B→A 는 세대 +2 — 같은 계정으로 돌아와도 시작 때 세대(0)의 늦은 응답은 버린다', () => {
    const e = new ResultAuthEpoch()
    e.observe({ event: 'INITIAL_SESSION', userId: 'A' })
    const started = e.gen
    e.observe({ event: 'SIGNED_IN', userId: 'B' })
    e.observe({ event: 'SIGNED_IN', userId: 'A' })
    expect(e.gen).toBe(2)
    expect(acceptsAtEpoch(started, e)).toBe(false)
    expect(acceptsAtEpoch(e.gen, e)).toBe(true)
  })
  it('로그아웃(SIGNED_OUT)은 userId 와 무관하게 신원 없음으로 — 세대가 바뀐다', () => {
    const e = new ResultAuthEpoch()
    e.observe({ event: 'INITIAL_SESSION', userId: 'A' })
    e.observe({ event: 'SIGNED_OUT', userId: 'A' })
    expect(e.gen).toBe(1)
  })
  it('바뀌지 않았으면 시작 세대 응답을 받는다', () => {
    const e = new ResultAuthEpoch()
    e.observe({ event: 'INITIAL_SESSION', userId: 'A' })
    expect(acceptsAtEpoch(0, e)).toBe(true)
  })
})
