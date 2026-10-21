// apps/web/src/components/textviewer/__tests__/TextHubContent-failure.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ error: null as Error | null }))
vi.mock('@/hooks/useTexts', () => ({ useTexts: () => ({ texts: [], isLoading: false, error: state.error, stats: { total: 0, conquered: 0, inProgress: 0, notStarted: 0 }, continueText: null }) }))
vi.mock('@/hooks/useSubscribedSets', () => ({ useSubscribedSets: () => ({ sets: [] }) }))
vi.mock('@/hooks/useUserVLevel', () => ({ useUserVLevel: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/text' }))
import { TextHubContent } from '../TextHubContent'

describe('My Library failure and first-use views', () => {
  it('offers retry with an error illustration rather than claiming the library is empty', () => {
    state.error = new Error('lookup failed')
    const html = renderToString(<TextHubContent />)
    expect(html).toContain('자료를 확인하지 못했어요')
    expect(html).toContain('다시 불러오기')
    expect(html).toContain('spot-offline.webp')
    expect(html).not.toContain('여기서 시작합니다')
  })
  it('retains the first-use view when the read really succeeded with no items', () => {
    state.error = null
    const html = renderToString(<TextHubContent />)
    expect(html).toContain('여기서 시작합니다')
    expect(html).not.toContain('자료를 확인하지 못했어요')
  })
  it('keeps independently loaded textbooks available when the text lookup fails', () => {
    state.error = new Error('text lookup failed')
    const html = renderToString(<TextHubContent view="textbooks" textbookCount={1} textbooksSlot={<p>담은 교재 내용</p>} />)
    expect(html).toContain('담은 교재 내용')
    expect(html).not.toContain('자료를 확인하지 못했어요')
  })
})
