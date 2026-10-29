// apps/web/src/components/library/story/__tests__/complete-control-focus.test.tsx
// T-0224 — 「이 단위 읽음 표시」: 기다리는 동안 disabled 로 초점을 잃지 않고(aria-disabled), 표시되면 안내가 초점을 받을 수 있다(tabIndex -1).
// 이 화면에서 누른 그 표시일 때만 옮기는 판정(pressedRef · markedRef · onBlur 취소)은 실제 StoryReader PC 하네스(pa-t224)가 덮는다.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import { CompleteControl } from '../StoryReader'

const props = { unitIndex: 1, primary: true, onComplete: () => {} }

describe('CompleteControl 초점 경계', () => {
  it('준비: 보통 단추(aria-disabled 없음)', () => {
    const html = renderToStaticMarkup(<CompleteControl {...props} marked={false} pending={false} />)
    expect(html).toContain('data-story-complete="ready"')
    expect(html).not.toContain('aria-disabled')
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/)
  })
  it('기다리는 중: disabled 가 아니라 aria-disabled · aria-busy — 단추가 초점을 끝까지 가진다', () => {
    const html = renderToStaticMarkup(<CompleteControl {...props} marked={false} pending />)
    expect(html).toContain('data-story-complete="pending"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/)
  })
  it('표시됨: 안내 문장이 초점을 받을 수 있다(tabIndex -1) — 탭 순서에는 넣지 않는다', () => {
    const html = renderToStaticMarkup(<CompleteControl {...props} marked pending={false} />)
    expect(html).toContain('data-story-complete="marked"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('이 단위는 읽음으로 표시했어요')
  })
  it('옮기는 조건: 그 요청이 끝나는 렌더에서만(실패면 해제 · 성공이면 한 번) · 떠나면(blur) 취소 · 반영 렌더의 blur 무시 · 기다리는 중 클릭 무시', () => {
    const src = readFileSync(path.resolve(__dirname, '../StoryReader.tsx'), 'utf8')
    const block = src.slice(src.indexOf('export function CompleteControl('), src.indexOf('function StatusDock('))
    expect(block).toMatch(/const finished = wasPendingRef\.current && !pending/)
    expect(block).toMatch(/if \(!pressedRef\.current \|\| !finished\) return\s+pressedRef\.current = false\s+if \(marked\) noteRef\.current\?\.focus\(\)/)
    expect(block).toMatch(/\}, \[pending, marked\]\)/)
    expect(block).toMatch(/markedRef\.current = marked/)
    expect(block).toMatch(/onBlur=\{\(\) => \{\s+if \(!markedRef\.current\) pressedRef\.current = false/)
    expect(block).toMatch(/if \(pending\) return\s+pressedRef\.current = true\s+onComplete\(\)/)
    expect(block).not.toMatch(/disabled=\{pending\}/)
  })
})
