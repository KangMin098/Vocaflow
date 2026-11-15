// apps/web/src/components/csat/theater/__tests__/SelfExplain.test.tsx
//
// 과거 자기 설명(T-0091) — 새로 쓰는 칸 · 저장 · 대조가 없고, 예전 기록만 읽기 전용으로 그대로 보인다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SelfExplanation } from '@/lib/csat/dissect'
import { SelfExplain } from '../SelfExplain'

const x = (o: Partial<SelfExplanation> = {}): SelfExplanation => ({ id: 'x1', item: '2026#31', kind: 'lure', choice: 1, tempting: '끌린 이유', reject: '배제 이유', at: 1, afterExplanation: true, compared: false, ...o })

describe('과거 자기 설명 — 읽기 전용', () => {
  it('기록이 없으면 아무것도 그리지 않는다(작성 칸 없음)', () => {
    expect(renderToStaticMarkup(<SelfExplain saved={[]} />)).toBe('')
  })

  it('예전 설명을 지우거나 고치지 않고 그대로 보인다', () => {
    const html = renderToStaticMarkup(<SelfExplain saved={[x(), x({ id: 'x2', choice: 4, tempting: '두 번째' })]} />)
    expect(html).toContain('data-count="2"')
    expect(html).toContain('끌린 이유')
    expect(html).toContain('배제 이유')
    expect(html).toContain('④')
  })

  it('입력 · 저장 · 채점 문구가 없다', () => {
    const html = renderToStaticMarkup(<SelfExplain saved={[x()]} />)
    expect(html).not.toMatch(/<textarea|<input|저장|정답입니다|틀렸어요|점수/)
  })
})
