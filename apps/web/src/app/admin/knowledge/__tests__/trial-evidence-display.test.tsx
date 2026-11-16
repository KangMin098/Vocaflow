// apps/web/src/app/admin/knowledge/__tests__/trial-evidence-display.test.tsx
// T-0085 — 설계 · 적용 목록 화면이 trial 을 같은 뜻으로 읽는가(현재 분석 · 재계산 필요 · 합성 · 확인 불가 · 비합성 ≠ 실제 참가자). DB 없음
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type T = { id: string; applicationId: string; design: Record<string, unknown>; status: string; synthetic: boolean | null; result: string | null; resultSummary: null; analyzedAt: null; createdAt: string; reviewRequiredAt: string | null }
let trials: T[] = []
const trial = (id: string, over: Partial<T>): T => ({ id, applicationId: 'a1', design: { min_n: 1, measures: ['정답률'] }, status: 'analyzed', synthetic: false, result: 'supported', resultSummary: null, analyzedAt: null, createdAt: '2026-10-01T00:00:00Z', reviewRequiredAt: null, ...over })

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: async () => ({ id: 'admin' }) }))
vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
vi.mock('@/components/admin/knowledge/VnextForms', () => ({ ApplicationForm: () => null, TrialForm: () => null, ApplicationStatusForm: () => null }))
vi.mock('@/lib/knowledge/server', () => ({ listItems: async () => [], listLinks: async () => [] }))
vi.mock('@/lib/knowledge/vnext-server', () => ({
  listApplications: async () => [{ id: 'a1', itemId: 'i1', surface: 'item_screen', surfaceRef: 'fixture-app', version: 1, status: 'active', statusReason: null, audience: {}, exclusions: {}, releasedAt: null, updatedAt: '2026-10-01T00:00:00Z', trials, attempts: { real: 0, synthetic: 0 } }],
}))

import KnowledgeDesignPage from '../design/page'
import KnowledgeProductPage from '../product/page'

const html = async (P: () => Promise<JSX.Element>) => renderToStaticMarkup(await P())

beforeEach(() => {
  trials = []
})

describe('trial 표시(T-0085)', () => {
  it('설계 — current/stale/synthetic/unknown 을 구분 · 「실제 학습자」 라벨 없음', async () => {
    trials = [trial('c', {}), trial('s', { reviewRequiredAt: '2026-10-22T00:00:00Z' }), trial('y', { synthetic: true }), trial('u', { synthetic: null })]
    const h = await html(KnowledgeDesignPage)
    expect(h).toContain('비합성 표시')
    expect(h).toContain('현재 분석(효과 입증 · 실제 참가자 확인 아님)')
    expect(h).toContain('재계산 필요(결과를 근거로 쓰지 않음)')
    expect(h).toContain('합성(경로 검증)')
    expect(h).toContain('합성 여부 미상')
    expect(h).not.toContain('실제 학습자')
    // 현재 분석 표지는 current 한 줄에만
    expect(h.split('현재 분석(효과 입증').length - 1).toBe(1)
  })
  it('적용 목록 — 비합성 표시 · 현재 분석 · 재계산 필요 수가 따로 · 「실제 N」 없음', async () => {
    trials = [trial('c', {}), trial('s', { reviewRequiredAt: '2026-10-22T00:00:00Z' }), trial('y', { synthetic: true })]
    const h = await html(KnowledgeProductPage)
    expect(h).toContain('검증 3(비합성 표시 2 · 현재 분석 1 · 재계산 필요 1)')
    expect(h).toMatch(/비합성 표시 [^·]*재계산 필요/)
    expect(h).not.toMatch(/실제 \d|· 실제 /)
  })
  it('대조 — trial 이 계획만 있으면 현재 분석 0', async () => {
    trials = [trial('p', { status: 'planned', result: null })]
    expect(await html(KnowledgeProductPage)).toContain('검증 1(비합성 표시 1 · 현재 분석 0 · 재계산 필요 0)')
  })
  it('P1-1 — 합성 · 확인 불가 analyzed+supported 는 두 화면에서 「지지」로 나오지 않는다 · current 만 결과', async () => {
    trials = [trial('y', { synthetic: true }), trial('u', { synthetic: null }), trial('s', { reviewRequiredAt: '2026-10-22T00:00:00Z' })]
    for (const P of [KnowledgeDesignPage, KnowledgeProductPage]) {
      const h = await html(P)
      expect(h).not.toMatch(/지지/)
      expect(h).toContain('효과 근거 아님')
      expect(h).toContain('확인 불가')
    }
    trials = [trial('c', {})]
    for (const P of [KnowledgeDesignPage, KnowledgeProductPage]) expect(await html(P)).toMatch(/지지/)
  })
})
