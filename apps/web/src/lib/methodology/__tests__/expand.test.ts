// apps/web/src/lib/methodology/__tests__/expand.test.ts
import { describe, expect, it } from 'vitest'
import { isClaimExpanded } from '../expand'

const ACTIVE = ['p1', 'r1']

describe('isClaimExpanded', () => {
  it('연 주장만 펼친다', () => {
    expect(isClaimExpanded('r1', 'r1', 'reason', ACTIVE)).toBe(true)
    expect(isClaimExpanded('r1', 'p1', 'principle', ACTIVE)).toBe(false)
  })
  it('사용자가 접으면(openClaim=\'\') 원칙도 다시 펼치지 않는다 — 예전 버그', () => {
    expect(isClaimExpanded('', 'p1', 'principle', ACTIVE)).toBe(false)
  })
  it('열린 주장이 이 방법에 없을 때(필터로 방법이 바뀜)만 원칙을 기본으로 편다', () => {
    expect(isClaimExpanded('other-method-claim', 'p1', 'principle', ACTIVE)).toBe(true)
    expect(isClaimExpanded('other-method-claim', 'r1', 'reason', ACTIVE)).toBe(false)
  })
})
