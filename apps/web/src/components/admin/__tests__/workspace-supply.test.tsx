// apps/web/src/components/admin/__tests__/workspace-supply.test.tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/csat/map/v62/supply-store', () => ({ loadSupplyLedger: mocks.load }))
import { AdminWorkspaceSupply } from '../csat-diagnosis/AdminWorkspaceSupply'
const adminDb = {} as SupabaseClient
const sessionDb = { rpc: vi.fn() } as unknown as SupabaseClient
beforeEach(() => { vi.clearAllMocks(); mocks.client.mockResolvedValue(sessionDb) })
describe('관리자 개인 공급의 인증 경계', () => {
  it('주문·공급이 없다는 것으로 수요도 없다고 단정하지 않는다', async () => {
    mocks.load.mockResolvedValue({status:'installed',lines:{}})
    const html=renderToStaticMarkup(await AdminWorkspaceSupply({db:adminDb,userId:'learner',workspaceId:'workspace'}))
    expect(html).toContain('주문·공급 연결 기록이 없습니다')
    expect(html).toContain('수요 등록 여부는 이 표시만으로 판단하지 않습니다')
    expect(html).not.toContain('등록된 수요·주문·공급 연결이 없습니다')
  })
  it('대상 소유 조회를 유지하고 충족도에는 요청 세션을 전달한다', async () => {
    mocks.load.mockResolvedValue({ status: 'installed', lines: { line: { order: null, delivered: 2, requested: 3, validDelivered: 1 } } })
    const html = renderToStaticMarkup(await AdminWorkspaceSupply({ db: adminDb, userId: 'learner', workspaceId: 'workspace' }))
    expect(mocks.load).toHaveBeenCalledWith(adminDb, 'learner', 'workspace', sessionDb)
    expect(html).toContain('공급 기록 2건')
    expect(html).toContain('현재 유효 1 / 요청 3')
  })
  it('세션 생성 실패를 빈 공급이나 완료로 바꾸지 않는다', async () => {
    mocks.client.mockRejectedValue(Error('session unavailable'))
    const html = renderToStaticMarkup(await AdminWorkspaceSupply({ db: adminDb, userId: 'learner', workspaceId: 'workspace' }))
    expect(mocks.load).not.toHaveBeenCalled()
    expect(html).toContain('공급 원장 조회 불가')
    expect(html).not.toContain('등록된 수요·주문·공급 연결이 없습니다')
  })
})
