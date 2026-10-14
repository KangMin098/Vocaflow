// apps/web/src/lib/csat/map/v62/__tests__/return-ctx.test.ts
// v6.2 P-M2 — 지도 ↔ 문항 복귀 문맥: 나갈 때 싣는 값 · 돌아와서 바뀐 점만 알림 · 옛 UUID 를 되살리지 않음 · 형식 검증
import { describe, expect, it } from 'vitest'

import { mapReturnQuery, parseMapReturn, returnQueryOf, withMapReturn } from '../../../map-return'
import type { SavedPlans } from '../../v4/plan-store'
import { outgoingCtx, returnNotes } from '../return-ctx'

const W1 = '11111111-2222-4333-8444-555555555555'
const W2 = '99999999-2222-4333-8444-555555555555'
const ver = (version: number) => ({ version, plan: { order: [], planned: {} }, reason: 'initial', note: null, restoredFrom: null, canon: 'v4', asOf: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z' }) as unknown as SavedPlans['byTemplate'][string]['latest']
const saved = (workspaceId: string, latest: number, goal: number | null): SavedPlans => ({
  status: 'installed',
  byTemplate: { 'ws.central-meaning': { workspaceId, template: 'ws.central-meaning', latest: ver(latest), history: [ver(latest)] } },
  goalVersionId: goal,
})

describe('나갈 때 싣는 문맥', () => {
  it('영구 TASK · 템플릿 · 학습자 Workspace UUID · 계획 버전 · 목표 버전', () => {
    const c = outgoingCtx(saved(W1, 3, 7), 'r.central_meaning', 'ws.central-meaning')
    expect(c).toEqual({ mapTask: 'r.central_meaning', ws: 'ws.central-meaning', mapWs: W1, mapPlan: '3', mapGoal: '7' })
    expect(withMapReturn('/csat/item/2022-20?check=1#principle', c)).toBe(`/csat/item/2022-20?check=1&from=map&map_task=r.central_meaning&ws=ws.central-meaning&map_ws=${W1}&map_plan=3&map_goal=7#principle`)
  })
  it('저장 계획이 없거나 저장 구조가 없으면 UUID · 버전을 싣지 않는다', () => {
    expect(outgoingCtx(null, 'r.central_meaning', 'ws.central-meaning')).toMatchObject({ mapWs: null, mapPlan: null, mapGoal: null })
    expect(outgoingCtx({ status: 'not_installed', byTemplate: {}, goalVersionId: null }, 'e.evidence_location', 'ws.evidence-locate')).toMatchObject({ mapWs: null, mapPlan: null })
  })
})

describe('돌아왔을 때 — 바뀐 점만, 옛 계획을 되살리지 않는다', () => {
  const back = parseMapReturn({ map_task: 'r.central_meaning', ws: 'ws.central-meaning', map_ws: W1, map_plan: '3', map_goal: '7' })
  it('같으면 알림 없음', () => {
    expect(returnNotes(saved(W1, 3, 7), back)).toEqual([])
  })
  it('계획 버전이 바뀌었다', () => {
    expect(returnNotes(saved(W1, 5, 7), back)).toEqual([{ kind: 'plan_changed', from: 3, to: 5 }])
  })
  it('Workspace 를 끝내고 다시 만들었다 — 버전 비교 대신 「다른 계획」', () => {
    expect(returnNotes(saved(W2, 1, 7), back)).toEqual([{ kind: 'workspace_replaced' }])
  })
  it('목표가 바뀌었다', () => {
    expect(returnNotes(saved(W1, 3, 8), back)).toEqual([{ kind: 'goal_changed' }])
  })
  it('문맥이 없거나 저장 구조가 없으면 비교하지 않는다', () => {
    expect(returnNotes(saved(W1, 3, 7), null)).toEqual([])
    expect(returnNotes({ status: 'not_installed', byTemplate: {}, goalVersionId: null }, back)).toEqual([])
  })
})

describe('형식 검증 — 조회하지 않고 모양만', () => {
  it('UUID · 버전 형식이 아니면 버린다', () => {
    const c = parseMapReturn({ map_ws: 'not-a-uuid', map_plan: '0', map_goal: '1e3' })
    expect([c.mapWs, c.mapPlan, c.mapGoal]).toEqual([null, null, null])
    expect(parseMapReturn({ map_ws: 'ABCDEF12-2222-4333-8444-555555555555' }).mapWs).toBeNull()
    expect(parseMapReturn({ map_ws: 'abcdef12-2222-4333-8444-555555555555' }).mapWs).toBe('abcdef12-2222-4333-8444-555555555555')
  })
  it('검색값 배열 · 키 목록을 한 곳에서', () => {
    expect(returnQueryOf({ map_task: ['r.central_meaning', 'x'], ws: 'ws.cohesion', other: 'y' })).toMatchObject({ map_task: 'r.central_meaning', ws: 'ws.cohesion' })
    expect(mapReturnQuery({ mapTask: 'r.central_meaning', mapWs: W1, mapPlan: '2' })).toBe(`&map_task=r.central_meaning&map_ws=${W1}&map_plan=2`)
  })
})
