// apps/web/src/components/admin/__tests__/sidebar-screen-titles.test.tsx
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_SECTIONS, adminPath, getAdminLocation } from '@/lib/admin/navigation'
import { WORKSPACES } from '@/lib/knowledge/vnext-labels'

let pathname = '/admin/csat'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
import CsatLayout from '@/app/admin/csat/layout'

const APP = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../app')
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.name === '__tests__'
      ? []
      : entry.isDirectory()
        ? pages(join(dir, entry.name))
        : entry.name === 'page.tsx'
          ? [join(dir, entry.name)]
          : []
  )
}
describe('관리자 화면 소속과 호환 경로', () => {
  it('7개 상위와 22개 하위를 유지하며 코퍼스·진단·기준 책임을 분리한다', () => {
    expect(ADMIN_SECTIONS).toHaveLength(7)
    expect(ADMIN_SECTIONS.flatMap(section => section.workspaces)).toHaveLength(22)
    expect(getAdminLocation('/admin/topic-corpus')?.workspace?.id).toBe('words.observations')
    expect(getAdminLocation('/admin/vrl/users')?.workspace?.id).toBe('learners.records')
    expect(getAdminLocation('/admin/vrl/diagnostic')?.workspace?.id).toBe('learners.diagnostics')
  })
  it('원리의 모든 기존 탭과 가져오기 원장이 원래 작업 공간에 연결된다', () => {
    for (const workspace of WORKSPACES) {
      for (const tab of workspace.tabs) {
        expect(getAdminLocation(tab.href)?.workspace?.id, tab.href).toBe(
          ({ ops: 'research.overview', map: 'research.principles', lab: 'research.evidence', design: 'research.design', product: 'research.application' })[workspace.key]
        )
      }
    }
    expect(getAdminLocation('/admin/methodology')?.workspace?.id).toBe('research.evidence')
  })
  it('현재 관리자 페이지 전수를 업무 영역에 연결한다', () => {
    const files = pages(join(APP, 'admin'))
    expect(files.length).toBeGreaterThanOrEqual(80)
    for (const file of files) {
      const route = file
        .slice(APP.length)
        .replaceAll('\\', '/')
        .replace(/\/page\.tsx$/, '')
      const location = getAdminLocation(route)
      expect(location, route).not.toBeNull()
      if (route !== '/admin') expect(location?.workspace, route).not.toBeNull()
    }
  })
  it('메뉴와 작업 링크의 정본 경로가 실제 페이지를 가리킨다', () => {
    for (const section of ADMIN_SECTIONS) {
      const links = [
        section,
        ...section.workspaces.flatMap((workspace) => [workspace, ...(workspace.tools ?? [])]),
      ]
      for (const item of links) {
        expect(existsSync(join(APP, adminPath(item.href), 'page.tsx')), item.href).toBe(true)
        expect(getAdminLocation(item.href)?.section.id, item.href).toBe(section.id)
      }
    }
  })
  it.each([
    ['/admin/csat/new', '교재 제작', '/admin/csat/new'],
    ['/admin/csat/diagnosis/learners/u-1', '학습자 기록', '/admin/csat/diagnosis/learners'],
    ['/admin/csat/evidence', '기출 분석', '/admin/kice'],
    ['/admin/csat/strategy', '설계·검증', '/admin/knowledge/design'],
    ['/admin/csat/blueprint', '설계·검증', '/admin/knowledge/design'],
  ])('%s의 공통 제목과 복귀가 실제 업무 소속을 따른다', (path, title, href) => {
    pathname = path
    const html = renderToString(
      <CsatLayout>
        <h2>작업 내용</h2>
      </CsatLayout>
    )
    expect([...html.matchAll(/<h1/g)]).toHaveLength(1)
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain(`>${title}</a>`)
    expect(html).not.toContain('교재 공장')
  })
  it('단어장 경계와 진단 예외를 접두사로 잘못 분류하지 않는다', () => {
    expect(getAdminLocation('/admin/vocabulary')?.workspace?.id).toBe('words.dictionary')
    expect(getAdminLocation('/admin/vocab/runs/7/seed')?.workspace?.id).toBe('words.decks')
    expect(getAdminLocation('/admin/vrl/users')?.section.id).toBe('learners')
    expect(getAdminLocation('/admin/vrl/taxonomy')?.section.id).toBe('words')
    expect(getAdminLocation('/admin/knowledge/item/mechanism-1')?.workspace?.id).toBe(
      'research.principles'
    )
    expect(getAdminLocation('/admin/unknown')).toBeNull()
  })
})
