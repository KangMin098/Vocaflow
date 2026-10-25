// apps/web/src/components/csat/judgment/__tests__/IrrelevantTool.test.tsx
// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { IrrelevantTool } from '../IrrelevantTool'

const items = itemsOf('R-IRRELEVANT')

describe('IrrelevantTool 초기 마크업', () => {
  for (const item of items) {
    it(`${item.id}: 정답 표지 없음 · 공개 호출 없음`, () => {
      const reveal = vi.fn()
      const html = renderToString(<IrrelevantTool item={item} reveal={reveal} />)
      expect(reveal).not.toHaveBeenCalled()
      expect(html).not.toContain('data-revealed')
      expect(html).not.toContain('해설 정답')
      expect(html).not.toContain('왜 무관한가')
      expect(html).toContain('data-reveal-btn')
    })
    it(`${item.id}: 선지 탭 5개 · aria · 판단 버튼`, () => {
      const html = renderToString(<IrrelevantTool item={item} reveal={vi.fn()} />)
      expect(html.match(/role="tab"/g)).toHaveLength(5)
      expect(html).toContain('aria-selected="true"')
      expect(html).toContain('aria-pressed="false"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain('data-verdict="breaks"')
      expect(html).toContain('data-cue="direction"')
      expect(html).not.toContain('* replica')
    })
  }
  it('기호 없는 원문은 정직한 빈 상태', () => {
    const bare = { ...items[0], units: items[0].units.map((u) => ({ ...u, text: u.text.replace(/^[①②③④⑤]\s*/, '') })) }
    const html = renderToString(<IrrelevantTool item={bare} reveal={vi.fn()} />)
    expect(html).toContain('data-irr-empty')
  })
})
