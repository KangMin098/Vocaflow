// apps/web/src/lib/csat/map/v62/__tests__/plan-goal-binding.test.ts
import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ data: vi.fn(), saved: vi.fn(), commit: vi.fn(), build: vi.fn(), find: vi.fn() }))
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
  loadSavedPlans: h.saved, commitPlan: h.commit, storeStatus: async () => 'installed', findCommitByKey: h.find,
}))
import { POST } from '@/app/api/csat/diagnosis/map/plan/route'

const request = () => new Request('http://owned.invalid/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
  template: 'ws.central-meaning', order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], planned: {}, reason: 'initial', expectedVersion: 0, clientKey: '10000000-0000-4000-8000-000000000001',
}) })
beforeEach(() => {
  vi.clearAllMocks()
  h.data.mockResolvedValue({ model: { goal: 80, goalSet: true }, v4: { saved: { goalVersionId: 10 } }, findAttempts: [], lifecycleActivity: [] }) // T-0078 — 정상 로드 = 읽힌 빈 원장
  h.saved.mockResolvedValue({ goalVersionId: 10 })
  h.build.mockReturnValue({ ok: true, templateTasks: [], canon: 'v6.2', plan: { order: [], tasks: [] }, asOf: '2026-10-16T00:00:00Z' })
  h.commit.mockResolvedValue({ ok: true, workspaceId: 'owned', version: 1, reused: false })
  h.find.mockReset().mockResolvedValueOnce(null).mockResolvedValue({ template: 'ws.central-meaning', version: 1, workspaceId: 'owned', goalVersionId: 10, reason: 'initial', note: null, restoredFrom: null, plan: { order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], tasks: [] } })
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
it('an old editor goal version cannot silently become the current server goal', async () => {
  const body = await request().json()
  const response = await POST(new Request('http://owned.invalid/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, expectedGoalVersion: 9 }) }))
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: 'goal_changed' })
  expect(h.commit).not.toHaveBeenCalled()
})
it('a raced different body is rejected after RPC key replay', async () => {
  h.find.mockReset().mockResolvedValueOnce(null).mockResolvedValue({ template: 'ws.central-meaning', version: 1, workspaceId: 'owned', goalVersionId: 10, reason: 'initial', note: 'another request', restoredFrom: null, plan: { order: ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure'], tasks: [] } })
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: 'client_key_reused' })
})
it('a missing committed row cannot acknowledge success', async () => {
  h.find.mockReset().mockResolvedValue(null)
  await expect(POST(request())).rejects.toThrow('계획 저장 결과를 확인하지 못했어요')
})
