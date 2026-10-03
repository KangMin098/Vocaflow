// apps/web/src/lib/design/__tests__/reference-design.test.ts
// 반복됐던 스타일 해제·관리자 예외·본문/포털 불일치의 구조적 회귀를 막는다.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../../../../../')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const cssFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name)
  return entry.isDirectory() ? cssFiles(file) : entry.name.endsWith('.css') ? [file] : []
})

describe('사용자가 지정한 두 디자인의 기본 적용', () => {
  it('저장값·URL·환경변수로 플랫폼 스킨을 해제하지 않는다', () => {
    const layout = read('apps/web/src/app/layout.tsx')
    expect(layout).toContain('data-skin="tines"')
    expect(layout).not.toMatch(/process\.env\.NEXT_PUBLIC_SKIN|getItem\(['"]vocaflow-skin|setItem\(['"]vocaflow-skin|get\(['"]skin['"]\)/)
  })

  it('두 CSAT 라우트 그룹을 덮고 관리자는 기본 디자인을 받는다', () => {
    for (const group of ['(app)', '(main)']) {
      expect(read(`apps/web/src/app/${group}/csat/layout.tsx`)).toContain('data-design-scope="csat"')
    }
    const css = read('packages/design-tokens/src/skins/csat-app.css')
    expect(css).toContain(':root:has([data-design-scope="csat"]) {')
    expect(css).toContain(':root[data-theme="dark"]:has([data-design-scope="csat"]) {')
    expect(css).not.toContain('[data-area="admin"]')
    expect(read('apps/web/src/app/admin/layout.tsx')).not.toContain('data-design-scope="csat"')
  })

  it('CSAT은 본문 안의 색·서체 재선언으로 포털과 갈라지지 않는다', () => {
    const files = cssFiles(path.join(root, 'apps/web/src/components/csat'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), path.relative(root, file))
        .not.toMatch(/--(?:bg[23]?|bd(?:-input|-strong)?|t[1234]|p(?:-light|-hover|-dark)?|on-p|ju(?:-light|-ink)?|font-[a-z-]+)\s*:/)
    }
    const globals = read('apps/web/src/app/globals.css')
    expect(globals.indexOf("skins/csat-app.css")).toBeGreaterThan(globals.indexOf("skins/tines.css"))
    expect(globals).not.toContain('skins/admin-app.css')
    const tinesRules = globals.split('\n').filter(line => line.startsWith(':root[data-skin="tines"]'))
    expect(tinesRules.length).toBeGreaterThan(0)
    for (const rule of tinesRules) expect(rule).toContain(':not(:has([data-design-scope="csat"]))')
  })

  it('다크 모드에서 반전되는 행동색과 전경색을 짝으로 사용한다', () => {
    for (const file of ['home/home.module.css', 'workspace/workspace.module.css']) {
      const css = read(`apps/web/src/components/csat/${file}`)
      expect(css).not.toMatch(/background:\s*var\(--t1\);[^}]*color:\s*#fff\b/)
      expect(css).toContain('background: var(--p); color: var(--on-p);')
    }
    for (const file of ['map.module.css', 'popup.module.css']) {
      expect(read(`apps/web/src/components/csat/diagnosis/map/${file}`)).not.toMatch(/color:\s*#fcf9f5/)
    }
  })

  it('시험 기록과 지도 상태의 전경·배경이 같은 테마를 따른다', () => {
    const board = read('apps/web/src/components/csat/diagnosis/board.module.css')
    for (const [local, global] of [['m-field', 'bg'], ['m-t1', 't1'], ['m-t2', 't2']]) {
      expect(board).toContain(`--${local}: var(--${global});`)
    }
    expect(board).toMatch(/\.modal \.done\s*\{[^}]*background: var\(--p\);[^}]*color: var\(--on-p\);/)
    const map = read('apps/web/src/components/csat/diagnosis/map/map.module.css')
    for (const [status, semantic] of [['met', 'success'], ['near', 'warning'], ['short', 'error']]) {
      expect(map).toContain(`--m-${status}-ink: var(--${semantic}-ink);`)
      expect(map).toContain(`--m-${status}-bg: var(--${semantic}-light);`)
    }
  })
})
