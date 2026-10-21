// apps/web/src/hooks/__tests__/useTexts-failure.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
const order = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ order }) }) }) }) }))
import { fetchTexts } from '../useTexts'

describe('My Library lookup failures are not successful empty results', () => {
  beforeEach(() => order.mockReset())
  it('rejects a failed database read', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'network unavailable' } })
    await expect(fetchTexts('fixture-user')).rejects.toThrow('내 라이브러리를 불러오지 못했습니다')
  })
  it('preserves a genuine empty library', async () => {
    order.mockResolvedValue({ data: [], error: null })
    await expect(fetchTexts('fixture-user')).resolves.toEqual([])
  })
})
