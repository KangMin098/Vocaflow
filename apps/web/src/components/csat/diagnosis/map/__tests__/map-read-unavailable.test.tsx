// apps/web/src/components/csat/diagnosis/map/__tests__/map-read-unavailable.test.tsx
// T-0078 — 필수 원장을 못 읽은 지도 = 복구 상태만(0건 · 약점 · 미설치 · 승인 대기 추정 없음 · 계획 확정/자료 받기/수행 0 없음)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, replace() {}, push() {} }), usePathname: () => '/csat/diagnosis', useSearchParams: () => new URLSearchParams() }))

import { MapReadUnavailable } from '../MapReadUnavailable'
import { UnifiedLearningMap } from '../UnifiedLearningMap'

const data = (o: Record<string, unknown>) => ({ now: '2026-10-21T00:00:00Z', v4: { sessions: [] }, model: { goal: 80, goalSet: true }, ...o }) as never

describe('MapReadUnavailable', () => {
  it('읽기 실패 문구 · 0건 아님 · 다시 불러오기(44px cta) · 행동 CTA 없음', () => {
    const h = renderToStaticMarkup(<MapReadUnavailable retrying={false} onRetry={() => undefined} />)
    expect(h).toContain('학습 기록을 지금 읽지 못했어요')
    expect(h).toContain('0건이라거나 부족하다는 뜻이 아니에요')
    expect(h).toContain('data-testid="map-read-retry"')
    expect(h).not.toMatch(/미설치|승인 대기|약점이에요/)
    expect(renderToStaticMarkup(<MapReadUnavailable retrying onRetry={() => undefined} />)).toContain('다시 불러오는 중')
  })
  it('지도: 첫 시도 또는 수행 기록 undefined → 복구 상태만 그린다(계획 · 공급 · 노드 없음)', () => {
    for (const o of [{ findAttempts: undefined, lifecycleActivity: [] }, { findAttempts: [], lifecycleActivity: undefined }]) {
      const h = renderToStaticMarkup(<UnifiedLearningMap data={data(o)} mode="full" recordHref="/csat/diagnosis" />)
      expect(h).toContain('data-testid="map-read-unavailable"')
      expect(h).not.toMatch(/plan-save|ws-authored-request|umap-top-next|umap-node/)
    }
  })
})
