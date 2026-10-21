// apps/web/src/components/workspace/__tests__/insight-memory.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InsightPanel } from '../InsightPanel'

describe('Reader insight memory availability', () => {
  it('unavailable counts show a scoped route rather than invented counts or zero mastery', () => {
    const html = renderToString(<InsightPanel isOpen onClose={() => {}} bookmarks={[]} memoryStats={null} memoryHref="/wordvault/browse?filter=reader-text" />)
    expect(html).toContain('기억 상태는 단어장에서 확인할 수 있어요')
    expect(html).toContain('href="/wordvault/browse?filter=reader-text"')
    expect(html).not.toContain('잘 기억하고 있어요')
    expect(html).not.toContain('처음 만난 단어')
  })
  it('actual zero counts remain an available result', () => {
    const html = renderToString(<InsightPanel isOpen onClose={() => {}} bookmarks={[]} memoryStats={{ stable: 0, shaky: 0, risk: 0, newWords: 0 }} />)
    expect(html).not.toContain('기억 상태는 단어장에서 확인할 수 있어요')
    for (const label of ['안정', '흔들림', '위험', '신규']) expect(html).toContain(label)
  })
})
