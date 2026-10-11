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

it('seals exam targets, licensed resources and companion activities from the admin inputs', async () => {
  const resource = { kind: 'text', canonical_source: 'frym', canonical_url: 'https://example.org/text-b',
    content: 'A second synthetic account gives a different explanation of the same event.',
    license_evidence: 'Synthetic permission recorded for this fixture only.', license: 'CC BY 4.0',
    license_url: 'https://example.org/license', commercial_use: true, derivative_use: true,
    ai_processing: 'allowed', third_party_text: false, share_alike: false,
    attribution: 'Synthetic fixture source', checked_at: '2026-10-08T00:00:00Z' }
  const withBrief = (extra: Record<string, unknown>, draft: Record<string, unknown> = {}) => {
    const next = { ...brief, ...extra }
    return { ...input(), brief: next, plan_hash: planProductBrief(next).plan_hash, ...draft }
  }
  const p13 = withBrief({ product_family: 'P13' })
  expect((await send(p13)).status).toBe(400)
  const sealed = await (await send({ ...p13, resources: [resource] })).json()
  expect(sealed.order.target.resources).toHaveLength(1)
  const p18 = withBrief({ product_family: 'P18' }, { language_band: 'high', passage_v_level: 7, grade: 'middle_2' })
  expect((await send(p18)).status).toBe(400)
  expect((await send({ ...p18, exam: 'csat' })).status).toBe(200)
  const companion = await (await send(withBrief({ companion_activities: ['grammar_practice', 'vocab_cards'] }))).json()
  expect(companion.order.activity_types).toEqual(['grammar_practice', 'vocab_cards'])
  expect((await send({ ...input(), brief: { ...brief, companion_activities: ['tarot_reading'] } })).status).toBe(400)
})
