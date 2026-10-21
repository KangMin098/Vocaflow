// apps/web/src/app/admin/compose/__tests__/authorization.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  denied: new Error('ADMIN_ACCESS_DENIED'),
  guard: vi.fn(), db: vi.fn(), revalidate: vi.fn(), fetch: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.guard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.db }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import * as actions from '../actions'

afterEach(() => { vi.unstubAllGlobals() })
describe('Compose 액션 직접 호출 권한', () => {
  it.each(Object.entries(actions).filter(([, value]) => typeof value === 'function'))(
    '%s는 권한 거부 시 입력·외부 요청·DB보다 먼저 중단한다', async (_name, action) => {
      vi.clearAllMocks()
      mocks.guard.mockRejectedValue(mocks.denied)
      vi.stubGlobal('fetch', mocks.fetch)
      const invoke = action as (...args: unknown[]) => Promise<unknown>
      await expect(invoke({}, 'id', {}, [], [])).rejects.toBe(mocks.denied)
      expect(mocks.guard).toHaveBeenCalledWith('/admin/compose')
      expect(mocks.db).not.toHaveBeenCalled()
      expect(mocks.fetch).not.toHaveBeenCalled()
      expect(mocks.revalidate).not.toHaveBeenCalled()
    }
  )
})
