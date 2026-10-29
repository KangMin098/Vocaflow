// apps/web/src/lib/csat/map/v62/__tests__/evidence-read.test.ts — T-0078: 성공한 [] = 정상 · undefined = 읽지 못함
import { describe, expect, it } from 'vitest'

import { EVIDENCE_UNAVAILABLE, evidenceReadOf } from '../evidence-read'

describe('evidenceReadOf', () => {
  it('둘 다 배열(빈 배열 포함) = ok', () => {
    expect(evidenceReadOf({ findAttempts: [], lifecycleActivity: [] })).toBe('ok')
    expect(evidenceReadOf({ findAttempts: [{}], lifecycleActivity: [{}] })).toBe('ok')
  })
  it('하나라도 undefined · 데이터 없음 = unavailable', () => {
    expect(evidenceReadOf({ findAttempts: undefined, lifecycleActivity: [] })).toBe('unavailable')
    expect(evidenceReadOf({ findAttempts: [], lifecycleActivity: undefined })).toBe('unavailable')
    expect(evidenceReadOf(null)).toBe('unavailable')
    expect(EVIDENCE_UNAVAILABLE).toBe('evidence_unavailable')
  })
})
