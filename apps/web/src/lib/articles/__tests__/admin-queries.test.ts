// apps/web/src/lib/articles/__tests__/admin-queries.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ guard: vi.fn(), admin: vi.fn(), session: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('react', async () => ({ ...await vi.importActual<Record<string, unknown>>('react'), cache: (fn: unknown) => fn }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.session }))
import { listAdminArticles } from '../admin-queries'

beforeEach(() => { vi.resetAllMocks() })

describe('관리자 글 목록의 인증 경계', () => {
  it('신원·역할·상태 가드가 거부하면 서비스 클라이언트를 만들지 않는다', async () => {
    const redirect = new Error('NEXT_REDIRECT')
    mocks.guard.mockRejectedValue(redirect)
    await expect(listAdminArticles({ statuses: ['ready'] })).rejects.toBe(redirect)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })

  it('가드를 기다린 뒤 같은 상태·출처·페이지 조건으로 기존 목록을 읽는다', async () => {
    let allow!: () => void
    mocks.guard.mockImplementation(() => new Promise<void>(resolve => { allow = resolve }))
    const query = { in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ id: 'article' }], error: null }) }
    const select = vi.fn(() => query), from = vi.fn(() => ({ select }))
    mocks.admin.mockReturnValue({ from })
    const pending = listAdminArticles({ statuses: ['ready'], source: 'voa', page: 2, pageSize: 100 })
    expect(mocks.admin).not.toHaveBeenCalled()
    allow()
    await expect(pending).resolves.toEqual([{ id: 'article' }])
    expect(mocks.guard).toHaveBeenCalledWith('/admin/articles')
    expect(from).toHaveBeenCalledWith('library_articles')
    expect(query.in).toHaveBeenCalledWith('status', ['ready'])
    expect(query.eq).toHaveBeenCalledWith('source', 'voa')
    expect(query.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(query.range).toHaveBeenCalledWith(200, 299)
  })

  it('조회 시간 초과를 빈 목록으로 숨기지 않는다', async () => {
    mocks.guard.mockResolvedValue({ role: 'admin' })
    const query = { order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: null, error: { message: 'statement timeout' } }) }
    mocks.admin.mockReturnValue({ from: () => ({ select: () => query }) })
    await expect(listAdminArticles()).rejects.toThrow('statement timeout')
  })
})
