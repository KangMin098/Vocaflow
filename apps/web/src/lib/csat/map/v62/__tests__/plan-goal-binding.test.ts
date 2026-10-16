// apps/web/src/lib/csat/map/v62/__tests__/plan-goal-binding.test.ts
import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ data: vi.fn(), saved: vi.fn(), commit: vi.fn(), build: vi.fn() }))
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ db: {}, userId: 'owned' }),
  readJson: (r: Request) => r.json(),
  failure: (e: Error) => { throw e },
}))
vi.mock('@/lib/csat/map/load', () => ({ loadMapPage: h.data }))
vi.mock('@/lib/csat/map/v4/compose', () => ({ composeV4: () => ({ plans: {}, asIs: { asOf: '2026-10-16T00:00:00Z' } }) }))
vi.mock('@/lib/csat/map/v4/plan-commit', async original => ({
  ...await original<typeof import('../../v4/plan-commit')>(), buildCommitPayload: h.build,
}))
vi.mock('@/lib/csat/map/v4/plan-store', () => ({
  loadSavedPlans: h.saved, commitPlan: h.commit, storeStatus: async () => 'installed', findCommitByKey: async () => null,
}))
import { POST } from '@/app/api/csat/diagnosis/map/plan/route'

const request = () => new Request('http://owned.invalid/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  template: 'ws.central-meaning', order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: '10000000-0000-4000-8000-000000000001',
}) })
beforeEach(() => {
  vi.clearAllMocks()
  h.data.mockResolvedValue({ model: { goal: 80, goalSet: true }, v4: { saved: { goalVersionId: 10 } } })
  h.saved.mockResolvedValue({ goalVersionId: 10 })
  h.build.mockReturnValue({ ok: true, templateTasks: [], canon: 'v6.2', plan: { order: [], tasks: [] }, asOf: '2026-10-16T00:00:00Z' })
  h.commit.mockResolvedValue({ ok: true, workspaceId: 'owned', version: 1, reused: false })
})
it('binds a committed PLAN to the exact goal used for calculation', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(h.commit.mock.calls[0][1].goalVersionId).toBe(10)
})
it.each([20, null])('goal change during computation rejects without writing: %s', async goalVersionId => {
  h.saved.mockResolvedValue({ goalVersionId })
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: 'goal_changed' })
  expect(h.commit).not.toHaveBeenCalled()
})
