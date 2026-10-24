// apps/web/src/components/csat/judgment/__tests__/SummaryTool.test.tsx
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import { SummaryTool } from '../SummaryTool'

const item = itemsOf('R-SUMMARY')[0]

describe('SummaryTool 초기 마크업', () => {
  const provider = vi.fn()
  const html = renderToString(<SummaryTool item={item} reveal={provider} />)
  it('마운트만으로 공개 자료를 부르지 않고 정답 표지가 없다', () => {
    expect(provider).not.toHaveBeenCalled()
    expect(html).not.toMatch(/정답|data-reveal-body|오답|내 조합<|why_correct|verdict/)
  })
  it('요약문·후보어·해설 보기·aria', () => {
    expect(html).toContain('data-summary="true"')
    expect(html).toContain('data-cand="A:effective"')
    expect(html).toContain('data-cand="B:difficulty"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-reveal="true"')
    expect(html).toContain('해설 보기')
  })
  it('주요 조작은 공통 44px 버튼 클래스를 쓴다', () => {
    const cand = html.match(/<button[^>]*data-cand="A:effective"[^>]*>/)?.[0] ?? ''
    expect(cand).toMatch(/class="[^"]*button/)
  })
  it('요약문 전문이 없으면 지어내지 않고 자료 없음을 표시', () => {
    const gap = { ...item, units: item.units.map((u) => (u.id === 'u9' ? { ...u, text: 'These individuals were more likely to have found jobs.' } : u)) }
    const h = renderToString(<SummaryTool item={gap} reveal={provider} />)
    expect(h).toContain('data-summary-gap')
    expect(h).not.toContain('data-summary="true"')
  })
})
