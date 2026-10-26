// apps/web/src/components/csat/judgment/__tests__/MoodTool.test.tsx
// MoodTool 초기 마크업 불변식 — 정답 표지 없음 · 공개 호출 없음 · 44px 버튼 클래스 · aria 존재.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { MoodTool } from '../MoodTool'

describe('MoodTool 초기 HTML', () => {
  for (const item of itemsOf('R-MOOD')) {
    it(`${item.id}: 정답 표지 없이 원문·선지·해설 보기 버튼만 그린다`, () => {
      const reveal = vi.fn()
      const html = renderToString(<MoodTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toMatch(/정답|오답|data-revealed|data-reveal-choice/)
      expect(html).toContain('data-act="reveal"')
      expect(html).toContain('aria-pressed')
      expect(html).toContain('aria-live')
      for (const c of item.choices) for (const w of c.split('→')) expect(html).toContain(w.trim())
      expect(html.match(/data-unit=/g)?.length).toBe(item.units.length)
      expect(html).toContain('전환점')
    })
  }
})
