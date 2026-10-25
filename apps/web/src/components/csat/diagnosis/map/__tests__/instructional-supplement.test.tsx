// apps/web/src/components/csat/diagnosis/map/__tests__/instructional-supplement.test.tsx
// T-0083 — 학습 전용 보조 진입 카드: 수식 관계 학습 자료 · 독립 확인 준비 중 범위 문구 · 기존 보조 카드와 testid 분리
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

import { AuthoredSupplyCard } from '../AuthoredSupplyCard'

describe('AuthoredSupplyCard kind=instructional(T-0083)', () => {
  it('제목 · 범위 문구(연습 기록 · 계획/확인 결과 불변) · 전용 testid', () => {
    const h = renderToStaticMarkup(<AuthoredSupplyCard kind="instructional" task="s.attachment" taskName="수식 관계" template="ws.sentence-core" planSaved past={false} />)
    expect(h).toContain('학습 자료 · 수식 관계')
    expect(h).toContain('data-testid="ws-authored-learn"')
    expect(h).toContain('data-testid="ws-authored-learn-scope"')
    expect(h).toContain('혼자 확인은 아직 준비 중')
    expect(h).toContain('계획 · 확인 결과는 바뀌지 않아요')
    expect(h).not.toMatch(/숙달|목표 달성|혼자 해낸 근거/)
  })
  it('대조 — 기존 보조 카드는 그대로', () => {
    const h = renderToStaticMarkup(<AuthoredSupplyCard kind="support" task="e.task_demand" taskName="발문 요구" template="ws.evidence-locate" planSaved past={false} />)
    expect(h).toContain('받은 자료 · 보조 TASK 발문 요구')
    expect(h).not.toContain('ws-authored-learn')
  })
})
