// apps/web/src/components/csat/judgment/__tests__/InfoMatchTool.test.tsx
// @vitest-environment node
// InfoMatchTool 초기 마크업 불변식 — 공개 전 HTML 에 정답 표지가 없고, 조작 요소에 44px 클래스와 aria 가 있다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { InfoMatchEmpty, InfoMatchTool } from '../InfoMatchTool'

const items = [...itemsOf('R-NOTICE'), ...itemsOf('R-FACT')]

describe('InfoMatchTool 초기 마크업', () => {
  for (const item of items) {
    it(`${item.id}: 공개 자료를 부르지 않고 정답 표지가 없다`, () => {
      const reveal = vi.fn()
      const html = renderToString(<InfoMatchTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toMatch(/data-revealed|data-compare|data-disagree|해설 판정|정답 [①-⑤]|함정:/)
      expect(html).toContain('data-action="reveal"')
      expect((html.match(/data-choice="/g) ?? []).length).toBe(5)
      expect(html).toMatch(/data-choice="1"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-choice="1"/)
      expect(html).toContain('aria-live="polite"')
      // 성분 단위 판단 버튼 — 일치·어긋남·언급 없음, 기호 병행
      expect(html).toMatch(/data-mark="absent"/)
      expect(html).toContain('≠')
      expect(html).toContain('role="button"')
      // 44px 공통 버튼 클래스 · 선지 어절 버튼(token)
      expect(html).toMatch(/class="[^"]*button/)
      expect(html).toMatch(/class="[^"]*token/)
    })
  }
  it('자료 없음 화면', () => {
    expect(renderToString(<InfoMatchEmpty />)).toContain('data-judgment-empty')
  })
  it('원문 단위가 없으면 정직한 빈 상태', () => {
    const html = renderToString(<InfoMatchTool item={{ ...items[0], units: [] }} reveal={vi.fn()} />)
    expect(html).toContain('원문 단위 자료가 없어')
  })
})
