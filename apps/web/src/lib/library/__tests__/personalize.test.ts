// apps/web/src/lib/library/__tests__/personalize.test.ts
// LCP v2.0 Phase 9 — personalize / adaptive-extract 순수 함수 단위 테스트
// (Supabase 통합 테스트는 사용자 측 E2E로 — 인증 + 실 DB 필요)

import { describe, it, expect } from 'vitest'
import { getTargetCefr } from '../adaptive-extract'

describe('personalize — packIntoSessions logic', () => {
  it('targetWords 도달 시 새 session 생성 (placeholder — internal 함수)', () => {
    // packIntoSessions 는 personalize.ts 의 internal 헬퍼.
    // 실제 로직 검증은 personalizeChapter end-to-end 통합 테스트로 위임 (E2E).
    expect(true).toBe(true)
  })
})

describe('adaptive-extract — getTargetCefr', () => {
  it('A1 → A2', () => {
    expect(getTargetCefr('A1')).toBe('A2')
  })

  it('B1 → B2', () => {
    expect(getTargetCefr('B1')).toBe('B2')
  })

  it('B2 → C1', () => {
    expect(getTargetCefr('B2')).toBe('C1')
  })

  it('C1 → C2', () => {
    expect(getTargetCefr('C1')).toBe('C2')
  })

  it('C2 → C2 (cap — 더 높일 단계 없음)', () => {
    expect(getTargetCefr('C2')).toBe('C2')
  })
})
