// apps/web/src/app/api/admin/csat/evidence/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const { guard, load } = vi.hoisted(() => ({ guard: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/csat/evidence-operations-loader', () => ({ loadEvidenceOperations: load }))
import { GET } from '../route'

const req = (q = '') => new Request(`http://localhost/api/admin/csat/evidence${q}`)

beforeEach(() => {
  guard.mockReset().mockResolvedValue({})
  load.mockReset()
})
it('관리자 거절 시 서비스 권한 조회를 수행하지 않는다', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
  expect((await GET(req())).status).toBe(403)
  expect(load).not.toHaveBeenCalled()
})
it('성공 응답은 캐시하지 않는다', async () => {
  load.mockResolvedValue({ readiness: { total: 1 }, loadError: null, readinessError: null })
  const response = await GET(req())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it('부분 실패도 성공적인 재검증으로 보고하지 않는다', async () => {
  load.mockResolvedValue({ readiness: null, readinessError: 'query failed' })
  expect((await GET(req())).status).toBe(503)
})
it('범위 질의를 로더에 넘긴다 — 학평은 학년 하나', async () => {
  load.mockResolvedValue({ readiness: null, loadError: null, readinessError: null })
  await GET(req('?set=hakpyeong&grade=2'))
  expect(load).toHaveBeenCalledWith({ set: 'hakpyeong', grade: 2 })
  await GET(req())
  expect(load).toHaveBeenLastCalledWith({ set: 'kice' })
})
