// apps/web/src/lib/knowledge/__tests__/find-targets.test.ts
// 학습 지도 FIND 적용 audience → 확인 문항 목록(기존 단수 item 행과 호환)
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { findTargetsOf } from '../product-server'

describe('findTargetsOf', () => {
  it('기존 행(item 단수)은 그대로 한 문항', () => {
    expect(findTargetsOf({ item: '2022#20' })).toEqual(['2022#20'])
  })
  it('items 를 이어 붙이고 중복 · 문자열 아닌 값을 뺀다', () => {
    expect(findTargetsOf({ item: '2022#20', items: ['2025#20', '2022#20', 7, ''] })).toEqual(['2022#20', '2025#20'])
  })
  it('없으면 빈 목록', () => {
    expect(findTargetsOf(null)).toEqual([])
    expect(findTargetsOf({})).toEqual([])
  })
})
