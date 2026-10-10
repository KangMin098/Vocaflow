// apps/web/src/app/api/admin/csat/structural-planning/__tests__/route.test.ts
import { NextResponse } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { guard, load, plan } = vi.hoisted(() => ({ guard: vi.fn(), load: vi.fn(), plan: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/csat/structural-planning', () => ({
  loadStructuralPlanningCatalog: load, planProductOrderStructure: plan,
}))
import { GET, POST } from '../route'
const originalDir = process.env.TEXTBOOK_STRUCTURAL_REFERENCE_DIR

beforeEach(() => {
  guard.mockReset().mockResolvedValue({})
  load.mockReset().mockResolvedValue({ profiles: [], corpus_hash: 'a'.repeat(64) })
  plan.mockReset().mockReturnValue({ selection: 'ignored', target_fit_evidence: false })
  process.env.TEXTBOOK_STRUCTURAL_REFERENCE_DIR = 'C:\\external-reference'
})
afterEach(() => {
  if (originalDir === undefined) delete process.env.TEXTBOOK_STRUCTURAL_REFERENCE_DIR
  else process.env.TEXTBOOK_STRUCTURAL_REFERENCE_DIR = originalDir
})

it('rejects non-admin reads before accessing external files', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
  expect((await GET()).status).toBe(403)
  expect(load).not.toHaveBeenCalled()
})

it('returns no-store metadata and fails closed when current evidence is unavailable', async () => {
  const result = await GET()
  expect(result.status).toBe(200)
  expect(result.headers.get('cache-control')).toBe('no-store')
  load.mockRejectedValue(new Error('STRUCTURAL_SOURCE_CHANGED'))
  expect((await GET()).status).toBe(503)
})

it('passes explicit adopt/ignore choices to a sealed-order planner without writing', async () => {
  const request = new Request('http://localhost/api/admin/csat/structural-planning', {
    method: 'POST', body: JSON.stringify({ order: { product_order_id: 'one' }, selected_source_ids: [] }),
  })
  const result = await POST(request)
  expect(result.status).toBe(200)
  expect(plan).toHaveBeenCalledWith({ product_order_id: 'one' },
    { profiles: [], corpus_hash: 'a'.repeat(64) }, [])
})
