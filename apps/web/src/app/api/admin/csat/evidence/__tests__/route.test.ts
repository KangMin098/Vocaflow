// apps/web/src/app/api/admin/csat/evidence/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const { guard, load } = vi.hoisted(() => ({ guard: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/csat/evidence-operations-loader', () => ({ loadEvidenceOperations: load }))
import { GET } from '../route'

beforeEach(() => {
  guard.mockReset().mockResolvedValue({})
  load.mockReset()
})
it('관리자 거절 시 서비스 권한 조회를 수행하지 않는다', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
  expect((await GET()).status).toBe(403)
  expect(load).not.toHaveBeenCalled()
})
it('성공 응답은 캐시하지 않는다', async () => {
  load.mockResolvedValue({ readiness: { total: 1 }, loadError: null, readinessError: null })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it('부분 실패도 성공적인 재검증으로 보고하지 않는다', async () => {
  load.mockResolvedValue({ readiness: null, readinessError: 'query failed' })
  expect((await GET()).status).toBe(503)
})
