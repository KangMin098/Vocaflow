// apps/web/src/lib/knowledge/__tests__/item-task-ref.test.ts
// 문항 과제 적용 키 — 코드가 찾는 키와 등록된 주석 문항이 정확히 맞물리는가(2026-10-10 모의평가 키 대소문자 사고)
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { annotatedItemIds } from '../claim-support'
import { currentItemTask } from '../item-tasks'
import { itemTaskRef, parseItemTaskRef } from '../product-server'

describe('문항 과제 키', () => {
  it('주석 문항마다 키가 왕복하고 그 문항의 과제로 돌아온다', () => {
    for (const id of annotatedItemIds()) {
      const ref = itemTaskRef('claim-support', id)
      expect(parseItemTaskRef(ref)).toEqual({ taskKey: 'claim-support', itemId: id })
      expect(currentItemTask(id)?.def.key).toBe('claim-support')
    }
  })
  it('모의평가 키는 대문자 M — 소문자 키는 없는 문항을 가리킨다', () => {
    expect(itemTaskRef('claim-support', 'M2506#20')).toBe('claim-support:M2506-20')
    expect(currentItemTask(parseItemTaskRef('claim-support:m2506-20')!.itemId)).toBeNull()
  })
})
