// apps/web/src/lib/csat/map/__tests__/home-progress.test.ts
//
// 지도 홈 「지도에서 하던 일」 — 지도 계산(composeV4 · applySaved) 결과에서 고르는 규칙만 본다.
// 계산 자체는 v4 테스트가 지킨다 — 여기서는 대역으로 바꿔 선택 · 추정 금지 분기를 고정한다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MapPageData } from '../load'

const compose = vi.fn()
vi.mock('../v4/compose', () => ({ composeV4: (...a: unknown[]) => compose(...a) }))
vi.mock('../v4/definition', () => ({ taskOf: (id: string) => ({ name: `과제 ${id}` }), templateOf: (id: string) => ({ name: `묶음 ${id}` }) }))
vi.mock('../v4/plan-commit', () => ({ applySaved: (view: { progress: unknown }, saved: { progress?: unknown }) => ({ ...view, progress: saved.progress ?? view.progress }) }))

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
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 2 }) })).plan).toEqual({ ws: 'ws.cohesion', name: '묶음 ws.cohesion', planned: 6, done: 2, task: 'B' })
  })
  it('T-0081 — 중심 TASK 는 다 했고 보조 TASK 가 남았으면 그 보조 행(계획 순서 그대로) · 남은 행을 못 찾으면 제안을 닫는다(추정 없음)', () => {
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: 2, done: 2 } }, { task: 'S', quantity: { planned: null, done: 0 } }, { task: 'T', quantity: { planned: 4, done: 1 } }] }))
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 3 }) })).plan?.task).toBe('T')
    compose.mockReturnValue(view({ cohesionRows: [{ task: 'B', quantity: { planned: 2, done: 2 } }] }))
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 3 }) })).plan).toBeNull()
  })
  it('다 했거나 계획량이 없으면 · 저장소가 없거나 읽기 실패면 제안하지 않는다', () => {
    compose.mockReturnValue(view())
    expect(mapProgressOf(data({ saved: saved({ planned: 6, done: 6 }) })).plan).toBeNull()
    expect(mapProgressOf(data({ saved: saved(null) })).plan).toBeNull()
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
