// apps/web/src/components/csat/judgment/__tests__/GrammarTool.test.tsx
// GrammarTool 초기 마크업 불변식 — 공개 전 HTML 에 정답 표지가 없고, 조작 요소에 44px 클래스와 aria 가 있다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { GrammarTool } from '../GrammarTool'

const items = itemsOf('R-GRAMMAR')

describe('GrammarTool 초기 마크업', () => {
  for (const item of items) {
    it(`${item.id}: 공개 자료를 부르지 않고 정답 표지가 없다`, () => {
      const reveal = vi.fn()
      const html = renderToString(<GrammarTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toMatch(/data-revealed|data-compare|틀린 곳|어법상 맞다|함정|why_correct/)
      expect(html).toContain('data-reveal')
      expect((html.match(/data-mark="/g) ?? []).length).toBe(5)
      expect(html).toMatch(/aria-pressed="true"[^>]*data-mark="1"|data-mark="1"[^>]*aria-pressed="true"/)
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('data-tok="0"')
      expect(html).toContain('(후보 · ')
    })
  }
  it('기호 없는 원문 — 자리를 만들 수 없다고 정직하게 보인다', () => {
    const item = { ...items[0], units: [{ id: 'u1', n: 1, kind: 'sentence', text: 'No marks.' }] }
    const html = renderToString(<GrammarTool item={item} reveal={vi.fn()} />)
    expect(html).toContain('밑줄 기호를 찾지 못해')
  })
})
