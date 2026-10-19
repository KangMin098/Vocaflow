// apps/web/src/app/admin/knowledge/__tests__/application-trace.test.tsx
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ errors: {} as Record<string, boolean> }))
const ID = '00000000-0000-4000-8000-000000000001'
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
vi.mock('@/components/admin/knowledge/KnowledgeFrame', () => ({ KnowledgeFrame: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@/lib/knowledge/item-tasks', () => ({ currentItemTask: () => null }))
vi.mock('@/lib/knowledge/live-chain', () => ({ resolveChain: () => ({ path: [], breaks: [] }) }))
vi.mock('@/lib/knowledge/product-server', () => ({
  anchorGate: vi.fn().mockResolvedValue(true), itemTaskRef: () => '', parseItemTaskRef: () => null,
  loadChainGraph: async () => ({ items: [], links: [] }),
  loadLiveApplication: async () => ({ app: { id: '00000000-0000-4000-8000-000000000002', version: 3 } }),
}))
vi.mock('@/lib/admin/application-attempts', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin/application-attempts')>(), loadApplicationAttempts: async () => [] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: () => q, then: (resolve: (r: unknown) => unknown) => Promise.resolve({
    data: table === 'knowledge_applications' ? { id: '00000000-0000-4000-8000-000000000001', item_id: 'item', status: 'active', surface: 'other', surface_ref: 'ref', version: 2 }
      : table === 'knowledge_inquiry_links' ? [{ inquiry_id: 'inq' }] : [],
    error: state.errors[table] ? { message: 'offline' } : null,
  }).then(resolve) }
  return q
} }) }))
import Page from '../product/[id]/page'
beforeEach(() => { state.errors = {} })
describe('적용 추적의 실패·등록·노출 경계', () => {
  it('적용 조회 실패를 404로 바꾸지 않는다', async () => {
    state.errors.knowledge_applications = true
    await expect(Page({ params: { id: ID } })).rejects.toThrow('적용 조회 실패')
  })
  it('탐구 조회 실패를 탐구 없음으로 바꾸지 않는다', async () => {
    state.errors.knowledge_inquiries = true
    await expect(Page({ params: { id: ID } })).rejects.toThrow('탐구 조회 실패')
  })
  it('이전 active 적용을 현재 노출 성공으로 표시하지 않는다', async () => {
    const html = renderToStaticMarkup(await Page({ params: { id: ID } }))
    expect(html).toContain('현재 제품이 선택하는 적용 ID·버전과 다릅니다')
    expect(html).toContain('다른 적용')
    expect(html).not.toContain('학습자에게 나가 있다')
    expect(html).toContain('버전 미상')
    expect(html).toContain('전역 효과 상태')
  })
})
