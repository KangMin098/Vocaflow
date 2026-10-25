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

describe('POST /api/csat/authored/supply — 원장 미확인(T-0078)', () => {
  beforeEach(() => { loadMapPage.mockReset(); requestAuthoredSupply.mockReset() })
  it('저장 계획이 있어도 첫 시도 · 수행 기록을 못 읽으면 503 evidence_unavailable · 공급 0회', async () => {
    for (const o of [{ findAttempts: undefined, lifecycleActivity: [] }, { findAttempts: [], lifecycleActivity: undefined }]) {
      loadMapPage.mockResolvedValueOnce({ now: '2026-10-21T00:00:00Z', ...o, model: { goal: 80, goalSet: true }, v4: { saved: { goalVersionId: 10, byTemplate: { 'ws.evidence-locate': { workspaceId: 'w1', latest: { version: 1 } } } } } })
      const r = await post({ task: 'e.evidence_location', template: 'ws.evidence-locate' })
      expect(r.status).toBe(503)
      expect((await r.json()).code).toBe('evidence_unavailable')
    }
    expect(requestAuthoredSupply).not.toHaveBeenCalled()
  })
})

describe('POST /api/csat/authored/supply — 학습 전용 보조 진입(T-0083)', () => {
  beforeEach(() => { loadMapPage.mockReset(); requestAuthoredSupply.mockReset(); loadMapPage.mockResolvedValue(null) })
  it('ws.sentence-core × s.attachment 만 소속 검사를 통과(다음은 기존 계획 확인) · 다른 묶음의 s.attachment 는 그대로 거절', async () => {
    expect((await (await post({ task: 's.attachment', template: 'ws.sentence-core' })).json()).code).toBe('plan_required')
    const r = await post({ task: 's.attachment', template: 'ws.central-meaning' })
    expect(r.status).toBe(400)
    expect((await r.json()).code).toBe('task_not_in_workspace')
    expect(requestAuthoredSupply).not.toHaveBeenCalled()
  })
  it('본문에 role · 수량을 실어도 무시된다(서버 수요는 buildDemand 가 교수 2역할로만 만든다)', async () => {
    await post({ task: 's.attachment', template: 'ws.sentence-core', role: 'independent_check', quantity: 9 })
    expect(requestAuthoredSupply).not.toHaveBeenCalled() // 계획 미저장 보호가 먼저(공급 0)
  })
})
