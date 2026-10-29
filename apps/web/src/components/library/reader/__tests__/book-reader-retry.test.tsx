// apps/web/src/components/library/reader/__tests__/book-reader-retry.test.tsx
// T-0262 — 본문 조회 실패 안내에 「이 장 다시 불러오기」. 실제 실패 → 재실패 → 성공 · 중복 누름 · 장 이동 뒤 늦은 응답은 PC 하네스(pe-t262)가 덮는다.
// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/library/books/b', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { ContentError } from '../BookContentReader'

const SRC = readFileSync(path.resolve(__dirname, '../BookContentReader.tsx'), 'utf8').replace(/\r\n/g, '\n')

describe('본문 조회 실패 — 다시 불러오기', () => {
  it('안내(role=alert)와 44px 다시 불러오기 단추 · 기다리는 동안 같은 단추가 aria-disabled · busy', () => {
    const idle = renderToString(<ContentError message="실패" retrying={false} onRetry={() => {}} />)
    expect(idle).toContain('role="alert"')
    expect(idle).toContain('data-reader-retry')
    expect(idle).toContain('min-h-[44px]')
    expect(idle).toContain('이 장 다시 불러오기')
    expect(idle).not.toContain('aria-disabled="')
    const busy = renderToString(<ContentError message="실패" retrying onRetry={() => {}} />)
    expect(busy).toContain('aria-disabled="true"')
    expect(busy).toContain('aria-busy="true"')
    expect(busy).not.toMatch(/\sdisabled(=|\s|>)/)
  })

  it('결선: 재시도 입력은 조회 effect 의존성 · 실패는 그 장에 묶임 · 기다리는 중 재누름 무시 · 자동 재시도 없음', () => {
    expect(SRC).toContain('}, [activeIdx, libraryBookId, contentCache, isLockedChapter, retryNonce])')
    expect(SRC).toContain('const error = failure && failure.idx === activeIdx ? failure.message : null')
    expect(SRC).toMatch(/const retryChapter = \(onButton: boolean\) => \{\n\s+if \(loading \|\| retryInFlight\.current\) return\n\s+retryInFlight\.current = true/)
    // 실패 처리에서 다시 부르지 않는다(자동 재시도 0)
    const effect = SRC.slice(SRC.indexOf('getChapterContent(client, libraryBookId, activeIdx)'), SRC.indexOf('}, [activeIdx, libraryBookId, contentCache, isLockedChapter, retryNonce])'))
    expect(effect).not.toMatch(/setRetryNonce|setTimeout|getChapterContent\(client[\s\S]*getChapterContent\(client/)
    // 실패 안내가 로딩보다 먼저 — 다시 불러오는 동안 단추가 사라지지 않는다
    expect(SRC.indexOf(') : error ? (')).toBeLessThan(SRC.indexOf(') : loading ? ('))
  })
})
