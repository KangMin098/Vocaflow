// apps/web/src/app/api/admin/csat/product-order-draft/route.test.ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'

const mocks = vi.hoisted(() => ({ requireAdminApi: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
import { POST } from './route'

const brief = {
  schema: 'textbook-product-brief/1', grade_scope: { mode: 'single_grade', grades: ['middle_2'] },
  purpose: 'relation_reading', domain_weights: { science: 1 }, genre_weights: { explanation: 1 },
  duration_days: 5, units_per_chapter: 5, difficulty: { start: 3, end: 6 },
  passage_words: { start: 180, end: 260 }, source_strategy: 'balanced',
}
const policy = (number: string) => ({ version: `v${number}`, hash: number.repeat(64) })
const input = () => ({
  brief, plan_hash: planProductBrief(brief).plan_hash, grade: 'middle_2',
  product_order_id: 'm2-order', order_revision: 1, series_id: 'relation', edition_id: 'first',
  product_variant: 'standard', language_band: 'middle', passage_v_level: 6, share_alike: false,
  unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1',
  volume_spec_version: 'volume-v1', layout_profile: 'reading-v1',
  policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'),
    benchmark: policy('4'), evidence: policy('5'), trust: policy('6') },
})
const send = (body: unknown) => POST(new Request('http://localhost/api/admin/csat/product-order-draft', {
  method: 'POST', body: JSON.stringify(body),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-09T00:00:00Z'))
  mocks.requireAdminApi.mockResolvedValue({ id: 'admin-1', role: 'admin' })
})
afterEach(() => { vi.useRealTimers() })

it('seals a planned order without DB registration and rejects stale or missing policy evidence', async () => {
  const response = await send(input())
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.order.planning_hash).toBe(input().plan_hash)
  expect(result.order.created_at).toBe('2026-10-09T00:00:00.000Z')
  expect(result.order_hash).toMatch(/^[a-f0-9]{64}$/)
  expect((await send({ ...input(), plan_hash: '0'.repeat(64) })).status).toBe(400)
  expect((await send({ ...input(), policies: { ...input().policies, rights: policy('') } })).status).toBe(400)
})

it('requires administrator role before constructing a draft', async () => {
  mocks.requireAdminApi.mockResolvedValueOnce({ id: 'curator-1', role: 'curator' })
  expect((await send(input())).status).toBe(403)
  mocks.requireAdminApi.mockResolvedValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  expect((await send(input())).status).toBe(403)
})
