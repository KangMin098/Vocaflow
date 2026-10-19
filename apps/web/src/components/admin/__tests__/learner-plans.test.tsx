// apps/web/src/components/admin/__tests__/learner-plans.test.tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/lib/csat/map/v4/plan-store', () => ({ loadSavedPlans: mocks.load }))
vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
import { AdminLearnerPlans } from '../csat-diagnosis/AdminLearnerPlans'
const db = {} as SupabaseClient
beforeEach(() => { vi.clearAllMocks() })
describe('학습자 저장 계획의 읽기 범위', () => {
  it('로그인 관리자 대신 전달받은 대상의 계획만 읽는다', async () => {
    mocks.load.mockResolvedValue({ status: 'installed', byTemplate: {}, goalVersionId: null })
    const html = renderToStaticMarkup(await AdminLearnerPlans({ db, userId: 'verified-learner' }))
    expect(mocks.load).toHaveBeenCalledWith(db, 'verified-learner')
    expect(html).toContain('verified-learner')
    expect(html).toContain('저장된 목표가 없습니다')
    expect(html).not.toContain('href="/csat')
  })
  it('조회 실패를 저장된 계획 없음으로 바꾸지 않는다', async () => {
    mocks.load.mockRejectedValue(Error('database down'))
    const html = renderToStaticMarkup(await AdminLearnerPlans({ db, userId: 'verified-learner' }))
    expect(html).toContain('계획을 읽지 못했습니다')
    expect(html).not.toContain('저장된 목표가 없습니다')
  })
  it('저장 구조 미설치를 실제 0건과 구별한다', async () => {
    mocks.load.mockResolvedValue({ status: 'not_installed', byTemplate: {}, goalVersionId: null })
    const html = renderToStaticMarkup(await AdminLearnerPlans({ db, userId: 'verified-learner' }))
    expect(html).toContain('계획 저장 구조가 연결되지 않았습니다')
    expect(html).not.toContain('저장된 목표가 없습니다')
  })
})
