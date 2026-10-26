// apps/web/src/app/api/csat/diagnosis/map/goal/__tests__/conflict.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({ error: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ db: {}, userId: 'synthetic-test' }),
  readJson: async (req: Request) => req.json(),
  failure: () => Response.json({ error: 'unavailable' }, { status: 500 }),
}))
vi.mock('@/lib/csat/map/server', async original => ({
  ...await original<typeof import('@/lib/csat/map/server')>(),
  setGoal: async () => { throw deps.error },
}))
const request = () => new Request('http://localhost/api/csat/diagnosis/map/goal', { method: 'PUT', body: JSON.stringify({ target: 85 }) })

describe('goal HTTP error boundary', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime('2026-10-23T04:00:00Z') })
  afterEach(() => { vi.useRealTimers() })

  it('a conflict created by an earlier module copy remains HTTP409 after route reload', async () => {
    const old = await import('@/lib/csat/map/v4/plan-store')
    deps.error = new old.GoalVersionConflictError('Goal changed')
    vi.resetModules()
    const { PUT } = await import('../route')
    const res = await PUT(request())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'goal_changed' })
  })

  it('a current conflict is HTTP409', async () => {
    const { PUT } = await import('../route')
    const { GoalVersionConflictError } = await import('@/lib/csat/map/v4/plan-store')
    deps.error = new GoalVersionConflictError('Goal changed')
    expect((await PUT(request())).status).toBe(409)
  })

  it('a network/read error with a conflict-like message remains HTTP500', async () => {
    deps.error = new Error('goal_changed')
    const { PUT } = await import('../route')
    expect((await PUT(request())).status).toBe(500)
  })
})
