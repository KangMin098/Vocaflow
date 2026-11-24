// apps/web/src/lib/csat/map/v62/__tests__/plan-change.test.ts
// T-0077 — 저장 계획 비교는 사실 나열: 단계 · 계획량 · 가용량 old → new, 단위는 각 쪽 단계 단위, null 은 미정 그대로
import { describe, expect, it } from 'vitest'

import { planChange, previousOf, unitOf } from '../plan-change'

const s = (task: string, stage: string | null, planned: number | null, available: number | null = planned) => ({ task, stage, planned, available })

describe('planChange', () => {
  it('같은 2문항이라도 확인 → 바로잡기는 단계 변화(수량은 같아 표시 안 함)', () => {
    const c = planChange([s('r.central_meaning', 'check', 2)], [s('r.central_meaning', 'repair', 2)])
    expect(c.status).toBe('changed')
    expect(c.tasks).toEqual([{ task: 'r.central_meaning', presence: 'both', stage: { from: 'check', to: 'repair' }, planned: null, available: null }])
  })
  it('적용 2지문 → 다시 확인 2문항 = 단위별 old/new(빼거나 합하지 않음)', () => {
    const c = planChange([s('r.central_meaning', 'transfer', 2)], [s('r.central_meaning', 'recheck', 2)])
    expect(c.tasks[0]!.planned).toEqual({ from: 2, fromUnit: '지문', to: 2, toUnit: '문항' })
  })
  it('가용 null = 미정 그대로(0 으로 바꾸지 않음) · 같으면 same', () => {
    const c = planChange([s('r.central_meaning', 'check', 2, 2)], [s('r.central_meaning', 'check', 2, null)])
    expect(c.tasks[0]!.available).toEqual({ from: 2, fromUnit: '문항', to: null, toUnit: '문항' })
    expect(planChange([s('a', 'check', 2)], [s('a', 'check', 2)])).toEqual({ status: 'same', orderChanged: false, tasks: [] })
  })
  it('순서만 바뀌면 순서 변화만 · 들어오고 빠진 TASK 는 그대로 말함', () => {
    expect(planChange([s('a', 'check', 1), s('b', 'check', 1)], [s('b', 'check', 1), s('a', 'check', 1)])).toEqual({ status: 'changed', orderChanged: true, tasks: [] })
    const c = planChange([s('a', 'check', 1)], [s('b', 'check', 1)])
    expect(c.tasks.map((x) => [x.task, x.presence])).toEqual([['a', 'removed'], ['b', 'added']])
    expect(c.orderChanged).toBe(false)
  })
  it('바로 앞 버전만(잘린 이력 = 비교 불가) · 단위', () => {
    expect(previousOf([{ version: 3 }, { version: 2 }], { version: 3 })).toEqual({ version: 2 })
    expect(previousOf([{ version: 3 }, { version: 1 }], { version: 3 })).toBeNull()
    expect([unitOf('transfer'), unitOf('check'), unitOf(null)]).toEqual(['지문', '문항', '문항'])
  })
})
