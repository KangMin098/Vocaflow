// apps/web/src/app/(main)/text/[id]/__tests__/article-practice-entry.test.tsx
// T-0204 — Reader 연습 진입 마크업: 있음 → 기존 링크 · 없음/기사 아님 → 아무것도 · 실패 → 안내 + 연습 페이지 링크(44px). 그리기만으로 호출 0.
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArticlePracticeEntry } from '../article-practice-entry'

const HREF = '/practice/article/267ef969-2a3a-4dc9-b6b7-a85246df543f'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArticlePracticeEntry', () => {
  it('available: 기존 문구의 연습 링크', () => {
    const html = renderToString(<ArticlePracticeEntry practice={{ state: 'available', href: HREF }} />)
    expect(html).toContain(`href="${HREF}"`)
    expect(html).toContain('다 읽었다면 · 발췌문으로 제목 · 주제 골라 보기')
    expect(html).not.toContain('연습 여부를 확인하지 못했어요')
  })
  it('none · 기사 글 아님(null) → 아무것도 그리지 않는다', () => {
    expect(renderToString(<ArticlePracticeEntry practice={{ state: 'none' }} />)).toBe('')
    expect(renderToString(<ArticlePracticeEntry practice={null} />)).toBe('')
    expect(renderToString(<ArticlePracticeEntry practice={undefined} />)).toBe('')
  })
  it('failed: 안내 문구 + 같은 연습 페이지 링크(44px), 연습 시작 링크 문구는 없음', () => {
    const html = renderToString(<ArticlePracticeEntry practice={{ state: 'failed', href: HREF }} />)
    expect(html).toContain('연습 여부를 확인하지 못했어요')
    const a = /<a[^>]*data-testid="reader-article-practice-recheck"[^>]*>/.exec(html)?.[0] ?? ''
    expect(a).toContain(`href="${HREF}"`)
    expect(a).toContain('min-h-[44px]')
    expect(html).toContain('연습 페이지에서 다시 확인하기')
    expect(html).not.toContain('발췌문으로 제목')
  })
  it('그리기만으로는 네트워크 호출이 없다(클릭 전 추가 호출 0)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (const p of [{ state: 'available', href: HREF }, { state: 'failed', href: HREF }] as const) renderToString(<ArticlePracticeEntry practice={p} />)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
