// apps/web/src/lib/csat/session/__tests__/dissect-catalog.test.ts
import { expect, it, vi } from 'vitest'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/supabase/paged-select', () => ({ pagedSelect: read }))
vi.mock('../catalog', () => ({ loadSessionCatalog: async () => ({ error: null, catalog: { items: [], types: [], exams: {}, papers: {}, anchored: [] } }) }))

it('권한 때문에 빈 분석 조회를 배포 결함으로 캐시하지 않는다', async () => {
  read.mockImplementation(async (_query, label) => label === 'dissection items' ? [{ id: '2026#32', type_id: 'R-BLANK', answer: 5 }] : [])
  const { loadDissectionCatalog } = await import('../../dissect-catalog')
  await expect(loadDissectionCatalog()).rejects.toThrow('로그인 상태')
  await expect(loadDissectionCatalog()).rejects.toThrow('로그인 상태')
  expect(read).toHaveBeenCalledTimes(4)
})
