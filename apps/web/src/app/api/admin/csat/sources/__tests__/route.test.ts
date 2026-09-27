// apps/web/src/app/api/admin/csat/sources/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const { guard, create, chain } = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn(), chain: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: create }))
import { GET, POST } from '../route'
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ id: 'admin' }); create.mockReturnValue({ from: chain }) })
it('GET and POST refuse before service access when admin guard fails', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  expect((await GET(new Request('http://localhost/api/admin/csat/sources'))).status).toBe(403)
  expect((await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST' }))).status).toBe(403)
  expect(create).not.toHaveBeenCalled()
})
it('rejects cross-origin cache writes before parsing or service access', async () => {
  const r = await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST', headers: { origin: 'https://untrusted.example' }, body: '{}' }))
  expect(r.status).toBe(403); expect(create).not.toHaveBeenCalled()
})
it.each(['?queue=constructor', '?id=not-a-uuid', '?page=-1'])('invalid filter %s is an error, not an empty success', async suffix => {
  expect((await GET(new Request('http://localhost/api/admin/csat/sources' + suffix))).status).toBe(400)
  expect(chain).not.toHaveBeenCalled()
})
it('missing count is not interpreted as zero inventory', async () => {
  const q = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], count: null, error: null }) }
  chain.mockReturnValue(q)
  const response = await GET(new Request('http://localhost/api/admin/csat/sources?queue=all'))
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

/* ── 조회 축 (2026-09-23) ──────────────────────────────────────────────────
 * 새 축은 전부 **화이트리스트**다. 모르는 값이 조용히 무시되면 관리자는 「그 조건으로 걸렀다」고
 * 믿은 채 안 걸린 목록을 본다 — 빈 결과보다 나쁘다(틀린 것을 맞다고 읽는다). */
it.each([
  '?grade=nonsense', '?status=nonsense', '?uses=nonsense', '?sort=nonsense',
  '?pageSize=7', '?band=12', '?reason=nonsense',
])('unknown query axis %s is a 400, never a silently unfiltered list', async suffix => {
  expect((await GET(new Request('http://localhost/api/admin/csat/sources' + suffix))).status).toBe(400)
  expect(chain).not.toHaveBeenCalled()
})

it('accepts several blockers at once and ANDs them', async () => {
  const filter = vi.fn().mockReturnThis()
  const q = { select: vi.fn().mockReturnThis(), filter, order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }) }
  chain.mockReturnValue(q)
  const r = await GET(new Request('http://localhost/api/admin/csat/sources?reason=content_unjudged,cefr_above_band'))
  expect(r.status).toBe(200)
  // 겹쳐 건 두 조건이 각각 containment 로 들어갔는가 — 하나만 걸리면 나머지가 조용히 사라진다.
  expect(filter.mock.calls.filter(([column, op]) => column === 'result->blockers' && op === 'cs')).toHaveLength(2)
})

it('page size changes the range window, not just the reported number', async () => {
  const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null })
  chain.mockReturnValue({ select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range })
  const r = await GET(new Request('http://localhost/api/admin/csat/sources?pageSize=60&page=2'))
  expect(await r.json()).toMatchObject({ pageSize: 60, page: 2 })
  expect(range).toHaveBeenCalledWith(120, 179)
})
