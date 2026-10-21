// apps/web/src/lib/csat/map/__tests__/home-progress.test.ts
//
// 지도 홈 「지도에서 하던 일」 — 지도 계산(composeV4 · applySaved) 결과에서 고르는 규칙만 본다.
// 계산 자체는 v4 테스트가 지킨다 — 여기서는 대역으로 바꿔 선택 · 추정 금지 분기를 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MapPageData } from '../load'

const compose = vi.fn()
vi.mock('../v4/compose', () => ({ composeV4: (...a: unknown[]) => compose(...a) }))
vi.mock('../v4/definition', () => ({ taskOf: (id: string) => ({ name: `과제 ${id}` }), templateOf: (id: string) => ({ name: `묶음 ${id}` }) }))
// T-0081(P1-1) — real.on 이면 실제 applySaved(정본 중심 집계)로 계산한다. 끄면 기존 진행만 흉내(아래 기존 시험)
const real = vi.hoisted(() => ({ on: false }))
vi.mock('../v4/plan-commit', async (orig) => {
  const actual = await orig<typeof import('../v4/plan-commit')>()
  return { applySaved: (view: { progress: unknown }, saved: { progress?: unknown }) => (real.on ? actual.applySaved(view as never, saved as never) : { ...view, progress: saved.progress ?? view.progress }) }
})

const { mapProgressOf } = await import('../home-progress')

const check = (attemptedItems: number, verifiedAt: string | null) => ({ check: { attemptedItems, verifiedAt } })
const view = (o: { mode?: string; tasks?: Record<string, unknown>; needs?: string[]; cohesionRows?: unknown[] } = {}) => ({
  asIs: { mode: o.mode ?? 'current', tasks: o.tasks ?? {} },
  toBe: { needs: (o.needs ?? []).map((task) => ({ task })) },
  plan: { primary: { id: 'ws.central-meaning' }, others: [{ id: 'ws.cohesion' }] },
  plans: {
    'ws.central-meaning': { core: ['A'], tasks: [{ task: 'A' }], progress: null },
    // T-0081 — 새 계약을 표현하는 최소 유효 TASK 행(계획량 · 수행량)
    'ws.cohesion': { core: ['B'], tasks: o.cohesionRows ?? [{ task: 'B', quantity: { planned: 6, done: 2 } }], progress: null },
  },
})
const data = (o: { goalSet?: boolean; findAttempts?: unknown[] | undefined; activity?: unknown[] | undefined; saved?: unknown } = {}) =>
  ({
    model: { goal: 80, goalSet: o.goalSet ?? true },
    findAttempts: 'findAttempts' in o ? o.findAttempts : [],
    lifecycleActivity: 'activity' in o ? o.activity : [],
    v4: { saved: o.saved ?? { status: 'installed', byTemplate: {}, goalVersionId: null } },
  }) as unknown as MapPageData

beforeEach(() => compose.mockReset())

describe('mapProgressOf — 확인 중 과제', () => {
  it('풀기 시작했지만 확인 판정 전인 과제 — 목표 요구 순서대로 첫 하나 · 그 과제의 중심 묶음', () => {
    compose.mockReturnValue(view({ tasks: { A: check(1, null), B: check(2, null) }, needs: ['B', 'A'] }))
    expect(mapProgressOf(data()).check).toEqual({ task: 'B', name: '과제 B', ws: 'ws.cohesion' })
  })
  it('확인 판정이 났거나 하나도 안 풀었으면 제안하지 않는다', () => {
    compose.mockReturnValue(view({ tasks: { A: check(3, '2026-10-01T00:00:00Z'), B: check(0, null) } }))
    expect(mapProgressOf(data()).check).toBeNull()
  })
  it('확인 시도를 못 읽었으면(undefined) 추정하지 않는다', () => {
    compose.mockReturnValue(view({ tasks: { A: check(1, null) } }))
    expect(mapProgressOf(data({ findAttempts: undefined })).check).toBeNull()
  })
})

describe('mapProgressOf — 저장 계획', () => {
  const saved = (progress: unknown) => ({ status: 'installed', goalVersionId: 1, byTemplate: { 'ws.cohesion': { latest: { progress } } } })
  it('계획량에 못 미친 저장 계획 — 그 묶음과 진행', () => {
    compose.mockReturnValue(view())
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 2 }) })).plan).toMatchObject({ ws: 'ws.cohesion', name: '묶음 ws.cohesion', planned: 6, done: 2, task: 'B', resume: { planned: 6, done: 2 } })
  })
  it('T-0081 — 중심 TASK 는 다 했고 보조 TASK 가 남았으면 그 보조 행(계획 순서 그대로) · 남은 행을 못 찾으면 제안을 닫는다(추정 없음)', () => {
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: 2, done: 2 } }, { task: 'S', quantity: { planned: null, done: 0 } }, { task: 'T', quantity: { planned: 4, done: 1 } }] }))
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 3 }) })).plan?.task).toBe('T')
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: 2, done: 2 } }] }))
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 3 }) })).plan).toBeNull()
  })
  it('다 했거나 계획량이 없으면 · 저장소가 없거나 읽기 실패면 제안하지 않는다', () => {
    // T-0081(P1-1) — 완료 · 계획량 없음은 실제 TASK 행 값으로(집계만 흉내 내면 행과 모순된다)
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: 6, done: 6 } }] }))
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 6 }) })).plan).toBeNull()
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: null, done: 0 } }] }))
    expect(mapProgressOf(data({ saved: saved(null) })).plan).toBeNull()
    compose.mockReturnValue(view())
    expect(mapProgressOf(data({ saved: { status: 'not_installed', byTemplate: {}, goalVersionId: null } })).plan).toBeNull()
    expect(mapProgressOf(data({ saved: { ...saved({ planned: 6, done: 1 }), error: true } })).plan).toBeNull()
    // 수행 기록을 못 읽었으면 진행을 셀 수 없다 — 미완료로 제안하지 않는다
    expect(mapProgressOf(data({ activity: undefined, saved: saved({ planned: 6, done: 0 }) })).plan).toBeNull()
  })
})

describe('mapProgressOf — 추정 금지', () => {
  it('목표 미설정 · 과거 기준 보기 · 계산 재료 없음은 둘 다 null', () => {
    compose.mockReturnValue(view({ tasks: { A: check(1, null) } }))
    expect(mapProgressOf(data({ goalSet: false }))).toEqual({ check: null, plan: null })
    compose.mockReturnValue(view({ mode: 'past_reanalysis', tasks: { A: check(1, null) } }))
    expect(mapProgressOf(data())).toEqual({ check: null, plan: null })
    compose.mockReturnValue(null)
    expect(mapProgressOf(data())).toEqual({ check: null, plan: null })
  })
})

// T-0081(P1-1) — Codex 반례(실제 applySaved 5 경우 · 2 fail 3 pass) 이식: 중심 집계와 무관하게 실제 미완료 행을 이어간다
describe('mapProgressOf — 실제 applySaved 저장 계획', () => {
  const core = 'r.central_meaning', support = 'e.task_demand', ws = 'ws.central-meaning'
  const row = (task: string, planned: number | null, done: number) => ({ task, stage: 'check', quantity: { unit: '문항', available: 4, planned, done, remaining: planned === null ? null : Math.max(0, planned - done) } })
  const fixture = (cp: number | null, cd: number, sp: number | null, sd: number) => {
    real.on = true
    const tasks = [row(core, cp, cd), row(support, sp, sd)]
    const latest = { version: 1, plan: { order: [support, core], tasks: tasks.map((t) => ({ task: t.task, stage: t.stage, planned: t.quantity.planned })) } }
    compose.mockReturnValue({ asIs: { mode: 'current', tasks: {} }, toBe: { needs: [] }, plan: { primary: { id: ws }, others: [] }, plans: { [ws]: { workspace: ws, core: [core], tasks, progress: null } } })
    return { model: { goalSet: true, goal: 80 }, findAttempts: [], lifecycleActivity: [], v4: { saved: { status: 'installed', byTemplate: { [ws]: { latest } }, goalVersionId: 1 } } } as unknown as MapPageData
  }
  afterEach(() => { real.on = false })
  it('중심 2/2 완료 + 보조 4/1 = 보조 행 이어가기 · 중심 집계 2/2 그대로 · 이어갈 양은 보조 행 것', () => {
    expect(mapProgressOf(fixture(2, 2, 4, 1)).plan).toMatchObject({ task: support, planned: 2, done: 2, resume: { planned: 4, done: 1, unit: '문항' } })
  })
  it('중심 배정 없음(null) + 보조 4/1 = 보조 행 · 집계는 null(0 아님)', () => {
    expect(mapProgressOf(fixture(null, 0, 4, 1)).plan).toMatchObject({ task: support, planned: null, done: null, resume: { planned: 4, done: 1 } })
  })
  it('중심 미완료 + 보조 = 저장 순서(보조 먼저) · 모두 완료 = 닫음 · 원장 미확인 · 저장 읽기 실패 = 닫음', () => {
    expect(mapProgressOf(fixture(2, 0, 4, 1)).plan?.task).toBe(support)
    expect(mapProgressOf(fixture(2, 2, 4, 4)).plan).toBeNull()
    const d = fixture(2, 0, 4, 1) as unknown as { lifecycleActivity?: unknown[]; v4: { saved: Record<string, unknown> } }
    expect(mapProgressOf({ ...d, lifecycleActivity: undefined } as unknown as MapPageData).plan).toBeNull()
    expect(mapProgressOf({ ...d, v4: { saved: { ...d.v4.saved, error: true } } } as unknown as MapPageData).plan).toBeNull()
  })
})
