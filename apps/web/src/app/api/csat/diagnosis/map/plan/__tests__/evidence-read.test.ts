// apps/web/src/app/api/csat/diagnosis/map/plan/__tests__/evidence-read.test.ts
// T-0078 — 수행 기록을 읽지 못했으면 새 계획 저장 = 503 evidence_unavailable · commitPlan 0회.
//   같은 clientKey 의 이미 성공한 영수증은 원장 장애 중에도 먼저 돌려주고(prior), 본문이 다르면 기존대로 409
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadMapPage = vi.fn()
const commitPlan = vi.fn()
const findCommitByKey = vi.fn()
vi.mock('@/lib/csat/diagnosis/route-helpers', () => ({
  learnerContext: async () => ({ db: {}, userId: 'u1' }),
  readJson: async (req: Request) => req.json(),
  failure: (e: unknown) => new Response(String(e), { status: 500 }),
}))
vi.mock('@/lib/csat/map/load', () => ({ loadMapPage: (...a: unknown[]) => loadMapPage(...a) }))
vi.mock('@/lib/csat/map/v4/plan-store', () => ({
  commitPlan: (...a: unknown[]) => commitPlan(...a),
  findCommitByKey: (...a: unknown[]) => findCommitByKey(...a),
  loadSavedPlans: async () => ({ status: 'installed', byTemplate: {} }),
  storeStatus: async () => 'installed',
}))

const KEY = '11111111-2222-4333-8444-555555555555'
const body = { template: 'ws.central-meaning', order: ['r.central_meaning'], planned: {}, reason: 'check_result', expectedVersion: 1, expectedGoalVersion: 10, clientKey: KEY }
const post = async (b: unknown = body) => {
  const { POST } = await import('../route')
  return POST(new Request('http://x/api/csat/diagnosis/map/plan', { method: 'POST', body: JSON.stringify(b) }))
}
const mapData = (o: Record<string, unknown>) => ({ now: '2026-10-21T00:00:00Z', v4: { saved: { goalVersionId: 10, byTemplate: {} } }, model: { goal: 80, goalSet: true }, ...o })

describe('POST /api/csat/diagnosis/map/plan — 원장 미확인(T-0078)', () => {
  beforeEach(() => { loadMapPage.mockReset(); commitPlan.mockReset(); findCommitByKey.mockReset(); findCommitByKey.mockResolvedValue(null) })
  it('첫 시도 · 수행 기록 미확인 → 503 evidence_unavailable · 저장 함수 0회', async () => {
    for (const o of [{ findAttempts: undefined, lifecycleActivity: [] }, { findAttempts: [], lifecycleActivity: undefined }]) {
      loadMapPage.mockResolvedValueOnce(mapData(o))
      const r = await post()
      expect(r.status).toBe(503)
      expect((await r.json()).code).toBe('evidence_unavailable')
    }
    expect(commitPlan).not.toHaveBeenCalled()
  })
  it('같은 키의 이미 성공한 영수증은 원장 장애 중에도 그대로(지도 조회 전에 끝남)', async () => {
    findCommitByKey.mockResolvedValue({ version: 2, workspaceId: 'w1', template: body.template, reason: body.reason, note: null, restoredFrom: null, goalVersionId: 10, plan: { order: body.order, tasks: [{ task: 'r.central_meaning', stage: 'repair', planned: null, available: 2, rule: null }] } })
    loadMapPage.mockResolvedValue(mapData({ findAttempts: undefined, lifecycleActivity: undefined }))
    const r = await post()
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ version: 2, reused: true, workspaceId: 'w1' })
    expect(loadMapPage).not.toHaveBeenCalled()
    expect(commitPlan).not.toHaveBeenCalled()
  })
  it('같은 키 · 다른 본문 = 기존 409(원장 상태와 무관)', async () => {
    findCommitByKey.mockResolvedValue({ version: 3, workspaceId: 'w1', template: 'ws.other', order: [], planned: {}, reason: 'initial' })
    const r = await post()
    expect(r.status).toBe(409)
    expect((await r.json()).code).toBe('client_key_reused')
    expect(loadMapPage).not.toHaveBeenCalled()
  })
})
