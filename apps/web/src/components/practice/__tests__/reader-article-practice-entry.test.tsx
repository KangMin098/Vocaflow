// apps/web/src/components/practice/__tests__/reader-article-practice-entry.test.tsx
// T-0204 — 세 상태 마크업: 있음 → 링크 · 없음 → 아무것도 · 실패 → 알림 + 다시 시도(44px).
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ReaderArticlePracticeEntry } from '../ReaderArticlePracticeEntry'

const ID = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const r = (initial: Parameters<typeof ReaderArticlePracticeEntry>[0]['initial']) =>
  renderToString(<ReaderArticlePracticeEntry initial={initial} recheck={vi.fn()} />)

describe('ReaderArticlePracticeEntry', () => {
  it('available: 연습 링크만', () => {
    const html = r({ state: 'available', href: `/practice/article/${ID}` })
    expect(html).toContain(`href="/practice/article/${ID}"`)
    expect(html).not.toContain('reader-article-practice-retry')
  })
  it('none: 아무것도 그리지 않는다', () => {
    expect(r({ state: 'none' })).toBe('')
  })
  it('failed: 알림과 다시 시도 버튼(44px), 링크 없음', () => {
    const html = r({ state: 'failed', articleId: ID })
    expect(html).toContain('연습 정보를 확인하지 못했어요')
    expect(html).toMatch(/data-testid="reader-article-practice-retry"[^>]*class="[^"]*min-h-\[44px\]/)
    expect(html).not.toContain('/practice/article/')
  })
})
