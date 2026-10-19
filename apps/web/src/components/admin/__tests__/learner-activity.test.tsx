// apps/web/src/components/admin/__tests__/learner-activity.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ activity: vi.fn(), snapshots: vi.fn(), supply: vi.fn() }))
vi.mock('@/lib/admin/learner-activity', () => ({ loadAdminLearnerActivity: mock.activity, loadAdminLearnerSnapshots: mock.snapshots }))
vi.mock('@/lib/csat/map/v62/supply-store', () => ({ loadSupplyLedger: mock.supply }))
vi.mock('@/components/admin/AdminScreenHelp', () => ({ AdminScreenHelp: () => null }))
import { AdminLearnerActivity } from '../csat-diagnosis/AdminLearnerActivity'
import { AdminWorkspaceSupply } from '../csat-diagnosis/AdminWorkspaceSupply'
const db = {} as SupabaseClient
beforeEach(() => { vi.clearAllMocks(); mock.activity.mockResolvedValue({ state: 'loaded', rows: [], next: null, bindings: { state: 'loaded', rows: [] } }); mock.snapshots.mockResolvedValue({ state: 'loaded', rows: [] }) })
describe('관리자 수행·개인 공급 읽기 표시', () => {
  it('전달받은 대상만 조회하고 진단 보기 상태를 유지해 페이지를 넘긴다', async () => {
    mock.activity.mockResolvedValue({ state: 'loaded', rows: [], next: '42', bindings: { state: 'loaded', rows: [] } })
    const html = renderToStaticMarkup(await AdminLearnerActivity({ db, userId: 'target', base: '/admin/csat/diagnosis/learners/target?tab=records&view=types', before: '50' }))
    expect(mock.activity).toHaveBeenCalledWith(db, 'target', '50')
    expect(mock.snapshots).toHaveBeenCalledWith(db, 'target')
    expect(html).toContain('tab=records&amp;view=types&amp;activityBefore=42#activity')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('href="/csat')
  })
  it('조회 실패와 진단 보류를 빈 기록으로 표시하지 않는다', async () => {
    mock.activity.mockResolvedValue({ state: 'error' })
    mock.snapshots.mockResolvedValue({ state: 'held' })
    const html = renderToStaticMarkup(await AdminLearnerActivity({ db, userId: 'target', base: '/admin' }))
    expect(html).toContain('수행을 읽지 못했습니다')
    expect(html).toContain('보류 기록이 있어')
    expect(html).not.toContain('시도 기록이 없습니다')
    expect(html).not.toContain('진단 이력이 없습니다')
  })
  it('수요 원장은 같은 사용자·Workspace로 읽고 유효 수량 미상을 0으로 채우지 않는다', async () => {
    mock.supply.mockResolvedValue({ status: 'installed', lines: { task: { order: { state: 'producing', seq: 1 }, delivered: 1 } } })
    const html = renderToStaticMarkup(await AdminWorkspaceSupply({ db, userId: 'target', workspaceId: 'workspace' }))
    expect(mock.supply).toHaveBeenCalledWith(db, 'target', 'workspace')
    expect(html).toContain('공급 기록 1건')
    expect(html).toContain('현재 유효 미확인 / 요청 미확인')
    expect(html).not.toContain('공급 완료')
  })
  it('공급 조회 예외를 기록 없음으로 숨기지 않는다', async () => {
    mock.supply.mockRejectedValue(Error('offline'))
    const html = renderToStaticMarkup(await AdminWorkspaceSupply({ db, userId: 'target', workspaceId: 'workspace' }))
    expect(html).toContain('공급 원장 조회 불가')
    expect(html).not.toContain('연결이 없습니다')
  })
})
