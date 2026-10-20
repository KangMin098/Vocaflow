// apps/web/src/app/api/csat/authored/supply/route.test.ts — T-0056: 공급 요청의 TASK 가 그 Workspace 의 중심 · 보조에 실제로 들어 있어야 한다
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadMapPage = vi.fn()
const requestAuthoredSupply = vi.fn()
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ db: {}, userId: 'u1' }),
  readJson: async (req: Request) => req.json(),
  failure: (e: unknown) => new Response(String(e), { status: 500 }),
}))
vi.mock('@/lib/csat/map/load', () => ({ loadMapPage: (...a: unknown[]) => loadMapPage(...a) }))
vi.mock('@/lib/csat/authored/server', () => ({ requestAuthoredSupply: (...a: unknown[]) => requestAuthoredSupply(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

const post = async (body: unknown) => {
  const { POST } = await import('./route')
  return POST(new Request('http://x/api/csat/authored/supply', { method: 'POST', body: JSON.stringify(body) }))
}

describe('POST /api/csat/authored/supply — TASK 소속 검증(T-0056)', () => {
  beforeEach(() => { loadMapPage.mockReset(); requestAuthoredSupply.mockReset(); loadMapPage.mockResolvedValue(null) })
  it('그 Workspace 에 없는 TASK 는 지도 · 공급을 부르기 전에 400 task_not_in_workspace', async () => {
    const r = await post({ task: 'r.central_meaning', template: 'ws.evidence-locate' })
    expect(r.status).toBe(400)
    expect((await r.json()).code).toBe('task_not_in_workspace')
    expect(loadMapPage).not.toHaveBeenCalled()
    expect(requestAuthoredSupply).not.toHaveBeenCalled()
  })
  it('없는 Workspace 도 같은 거절', async () => {
    const r = await post({ task: 'e.task_demand', template: 'ws.nowhere' })
    expect((await r.json()).code).toBe('task_not_in_workspace')
  })
  it('중심 TASK · 보조 TASK 는 통과해 기존 경로(계획 확인)로 간다', async () => {
    for (const task of ['e.evidence_location', 'e.task_demand']) {
      const r = await post({ task, template: 'ws.evidence-locate' })
      expect((await r.json()).code, task).toBe('plan_required')
    }
    expect(loadMapPage).toHaveBeenCalledTimes(2)
  })
})
