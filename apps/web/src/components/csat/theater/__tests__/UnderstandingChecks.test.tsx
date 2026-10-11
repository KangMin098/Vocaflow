// apps/web/src/components/csat/theater/__tests__/UnderstandingChecks.test.tsx
//
// 이해 확인 · 비교 쌍(M4) — 정답 번호를 다시 묻지 않는다 · 선택 참여 · 지난 결과 표시 · 비교 쌍이 없으면 칸이 없다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CheckAttempt } from '@/lib/csat/dissect'
import type { UnderstandingCheck } from '@/lib/csat/understanding-check'
import { ComparePairs } from '../ComparePairs'
import { UnderstandingChecks } from '../UnderstandingChecks'

const checks: UnderstandingCheck[] = [
  { kind: 'evidence', sentenceCount: 5, correct: [3] },
  { kind: 'lure', choice: 2, options: ['반대 진술', '부분 사실', '무관', '범위 과대'], correct: '부분 사실' },
]
const noop = () => {}

describe('이해 확인 카드', () => {
  it('근거 문장 번호와 바뀐 성분을 묻는다 — 정답 선지 번호를 다시 고르게 하지 않는다', () => {
    const html = renderToStaticMarkup(<UnderstandingChecks itemId="2026#22" checks={checks} saved={[]} onRecord={noop} />)
    expect(html).toContain('근거 문장은 몇 번')
    expect(html).toContain('② 선지는 지문에서 무엇을 바꿨나요')
    expect(html).toContain('부분 사실')
    expect(html).not.toMatch(/정답은 몇 번/)
    expect(html).toContain('선택')
  })

  it('과제가 없으면 아무것도 그리지 않는다', () => {
    expect(renderToStaticMarkup(<UnderstandingChecks itemId="x" checks={[]} saved={[]} onRecord={noop} />)).toBe('')
  })

  it('지난 시도가 있으면 결과를 보인다(답을 열었으면 「답:」)', () => {
    const saved: CheckAttempt[] = [{ id: 'a', item: '2026#22', kind: 'evidence', correct: false, tries: 2, revealed: true, at: 1, afterExplanation: true }]
    const html = renderToStaticMarkup(<UnderstandingChecks itemId="2026#22" checks={checks} saved={saved} onRecord={noop} />)
    expect(html).toContain('답: 4번 문장')
  })

  it('복습으로 열면 지난 결과를 덮지 않고 다시 풀게 한다', () => {
    const saved: CheckAttempt[] = [{ id: 'a', item: '2026#22', kind: 'evidence', correct: true, tries: 1, revealed: false, at: 1, afterExplanation: true }]
    const html = renderToStaticMarkup(<UnderstandingChecks itemId="2026#22" checks={checks} saved={saved} review onRecord={noop} />)
    expect(html).toContain('복습 — 관계 다시 짚기')
    expect(html).not.toContain('맞아요')
  })
})

describe('같은 원리 비교 쌍', () => {
  it('검수된 쌍이 없으면 칸을 그리지 않는다(다른 문항이 있다고 꾸미지 않는다)', () => {
    expect(renderToStaticMarkup(<ComparePairs pairs={[]} compared={new Set()} onCompared={noop} />)).toBe('')
  })
  it('쌍마다 상대 문항 링크 · 같은 함정 · 검수 한 줄 · 비교 완료 버튼', () => {
    const html = renderToStaticMarkup(
      <ComparePairs
        pairs={[{ other: '2025#22', otherSlug: '2025-22', otherLabel: '2025학년도 수능 22번', choice: 2, otherChoice: 4, trap: '부분 사실', note: '진단 문장을 옮기고 결론 항을 빠뜨린다' }]}
        compared={new Set()}
        onCompared={noop}
      />,
    )
    expect(html).toContain('2025학년도 수능 22번')
    expect(html).toContain('부분 사실')
    expect(html).toContain('결론 항을 빠뜨린다')
    expect(html).toContain('두 오답을 비교했어요')
  })
})
