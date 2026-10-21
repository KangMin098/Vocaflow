// apps/web/src/app/admin/csat/__tests__/invalid-scope.test.tsx
import { renderToString } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), press: vi.fn(), review: vi.fn(), defects: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.auth }))
vi.mock('@/lib/csat/factory-line-views', () => ({ loadPressView: mocks.press, loadReviewView: mocks.review }))
vi.mock('@/lib/csat/review-defects', () => ({ loadReviewDefects: mocks.defects }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.client }))
vi.mock('../press/actions', () => ({ decideVolumeAction: vi.fn() }))
import PressPage from '../press/page'
import ReviewPage from '../review/page'

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: 'admin' }) })
it.each([
  { series: 'unknown', band: '4' },
  { series: 'unknown' },
  { band: 'no-number' },
])('입력 오류 %j는 두 화면 모두 조회 전에 복귀 경로를 제공한다', async searchParams => {
  for (const page of [PressPage, ReviewPage]) {
    const html = renderToString(await page({ searchParams }))
    expect(html).toContain('제작 기준을 확인하세요')
    expect(html).toContain('href="/admin/csat/new"')
    expect(html).not.toContain('series=unknown')
  }
  expect(mocks.auth).toHaveBeenCalledTimes(2)
  for (const fn of [mocks.press, mocks.review, mocks.defects, mocks.client]) expect(fn).not.toHaveBeenCalled()
})
