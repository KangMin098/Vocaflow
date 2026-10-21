// apps/web/src/components/admin/__tests__/sidebar-readability.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
let pathname = '/admin'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
import { AdminSidebar } from '../AdminSidebar'
import { ADMIN_SECTIONS } from '@/lib/admin/navigation'

describe('관리자 업무 레일', () => {
  it.each([
    ['/admin', 'home'],
    ['/admin/curation', 'content'],
    ['/admin/csat/press', 'factory'],
    ['/admin/vocabulary', 'words'],
    ['/admin/csat/diagnosis/exams/exam-1', 'learners'],
    ['/admin/csat/evidence', 'research'],
    ['/admin/knowledge/lab/research', 'research'],
    ['/admin/db', 'operations'],
  ])('%s에서 하나의 업무 영역만 활성화한다', (path, section) => {
    pathname = path
    const html = renderToString(<AdminSidebar />)
    expect([...html.matchAll(/data-admin-section=/g)]).toHaveLength(7)
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1)
    expect(html).toMatch(new RegExp(`aria-current="page" data-admin-section="${section}"`))
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toMatch(/<a[^>]*>[\s\S]*?<button/)
    expect(html).toContain('min-h-11')
    expect(html).toContain('focus-visible:outline')
  })
  it('첫 선택은 일곱 개의 업무 이름이며 안내 전용 화면은 상시 메뉴가 아니다', () => {
    expect(ADMIN_SECTIONS.map((section) => section.label)).toEqual([
      '작업 홈',
      '콘텐츠',
      '교재 제작',
      '어휘·사전',
      '학습자·진단',
      '연구·기준',
      '운영·시스템',
    ])
    expect(ADMIN_SECTIONS.map((section) => section.href)).not.toContain('/admin/library')
    expect(ADMIN_SECTIONS.map((section) => section.href)).not.toContain('/admin/reports')
    expect(JSON.stringify(ADMIN_SECTIONS)).not.toMatch(/[\u3040-\u30ff]/)
  })
})
