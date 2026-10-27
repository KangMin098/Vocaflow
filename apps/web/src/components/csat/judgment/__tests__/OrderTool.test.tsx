// apps/web/src/components/csat/judgment/__tests__/OrderTool.test.tsx
// OrderTool 초기 마크업 불변식 — 정답 표지 없음 · 44px 버튼 클래스 · aria · 자료 없음 상태.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { OrderTool } from '../OrderTool'
import { judgmentStyles } from '../JudgmentShell'

const items = itemsOf('R-ORDER')

describe('OrderTool 초기 HTML', () => {
  for (const item of items) {
    it(`${item.id}: 공개 전 정답 표지·해설 문구 없음, provider 미호출`, () => {
      const reveal = vi.fn()
      const html = renderToString(<OrderTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toMatch(/data-revealed|해설의 정답|해설의 순서|함정:|why_correct|verdict/)
      expect(html).toContain('data-reveal')
      expect(html).toContain('해설 보기')
    })
    it(`${item.id}: 배열 버튼·단서 버튼이 44px 공통 클래스와 aria 를 갖는다`, () => {
      const html = renderToString(<OrderTool item={item} reveal={vi.fn()} />)
      expect(html).toContain(judgmentStyles.button)
      expect((html.match(/data-move=/g) ?? []).length).toBe(6)
      expect(html).toMatch(/data-cue="[ABC]-\d+"[^>]*aria-pressed="false"/)
      expect(html).toContain('aria-live="polite"')
      expect(html).toMatch(/aria-label="\(A\) 앞으로"/)
      expect((html.match(/data-choice=/g) ?? []).length).toBe(5)
    })
  }
  it('단락 표지가 없으면 도구 대신 정직한 빈 상태', () => {
    const item = { ...items[0], units: items[0].units.map((u) => ({ ...u, text: u.text.replace(/^\([ABC]\)\s*/, '') })) }
    const html = renderToString(<OrderTool item={item} reveal={vi.fn()} />)
    expect(html).toContain('data-order-empty')
    expect(html).not.toContain('data-move=')
  })
})
