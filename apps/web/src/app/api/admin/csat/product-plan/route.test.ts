// apps/web/src/app/api/admin/csat/product-plan/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ requireAdminApi: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
import { POST } from './route'

const brief = () => ({
  schema: 'textbook-product-brief/1', grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] },
  purpose: 'relation_reading', domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 1 }, duration_days: 20, units_per_chapter: 5,
  difficulty: { start: 3, end: 6 }, passage_words: { start: 180, end: 260 }, source_strategy: 'balanced',
})
const send = (value: unknown) => POST(new Request('http://localhost/api/admin/csat/product-plan', {
  method: 'POST', body: JSON.stringify(value),
}))

beforeEach(() => mocks.requireAdminApi.mockResolvedValue({ id: 'admin-1', role: 'admin' }))

it('plans a multi-grade order from structured targeting without writing or inventing evidence', async () => {
  const response = await send(brief())
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.plan.product_family).toBe('P09')
  expect(data.plan.units).toHaveLength(20)
  expect(data.plan.units[0].grade_scope.grades).toEqual(['middle_1', 'middle_2'])
  expect(data.plan_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(data)).not.toContain('source_policy_hash')
})

it('rejects a malformed grade scope and unauthorized callers', async () => {
  expect((await send({ ...brief(), grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_3'] } })).status).toBe(400)
  mocks.requireAdminApi.mockResolvedValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  expect((await send(brief())).status).toBe(403)
})
