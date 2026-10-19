// apps/web/src/components/admin/__tests__/knowledge-navigation.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ path: '/admin/knowledge/product' }))
vi.mock('next/navigation', () => ({ usePathname: () => state.path }))
import { WorkspaceNav } from '../knowledge/WorkspaceNav'
describe('연구 영역의 공통/도메인 내비 책임', () => {
  it('공통 메뉴가 제공하는 제품 적용·성과 링크를 중복 렌더하지 않는다', () => {
    expect(renderToStaticMarkup(<WorkspaceNav />)).toBe('')
  })
})
