// apps/web/src/lib/csat/map/v4/__tests__/observation.test.ts
// FINAL §3 — 통합 관찰 계약: 하위 TASK 직접 확인 근거만 · 세 상태 · 점수 없음.
import { describe, expect, it } from 'vitest'

import type { AsIsMap, AsIsTask } from '../as-is'
import { partsOf } from '../definition'
import { integratedObservation } from '../observation'

const INTEGRATED = ['s.o.sentence_meaning_model', 'r.o.global_meaning_model', 'e.o.final_judgment']
const task = (id: string, o: Partial<AsIsTask>): AsIsTask => ({ id, status: 'unmeasured', basis: 'none', check: { taskKey: 'k' }, ...o }) as unknown as AsIsTask
const map = (fn: (id: string) => Partial<AsIsTask>, ids: string[]): AsIsMap => ({ tasks: Object.fromEntries(ids.map((id) => [id, task(id, fn(id))])) }) as unknown as AsIsMap

describe('통합 관찰 계약', () => {
  it.each(INTEGRATED)('%s: 하위 TASK 가 있고 통합 TASK 다', (id) => {
    expect(partsOf(id).length).toBeGreaterThan(0)
    expect(integratedObservation(id, map(() => ({}), partsOf(id)))).not.toBeNull()
  })

  it('원자 TASK · 알 수 없는 TASK 는 null(지어내지 않는다)', () => {
    expect(integratedObservation('r.central_meaning', map(() => ({}), []))).toBeNull()
    expect(integratedObservation('x.unknown', map(() => ({}), []))).toBeNull()
  })

  it.each(INTEGRATED)('%s: 모든 하위 TASK 직접 확인 → 통합 관찰 가능 · 점수 필드 없음', (id) => {
    const o = integratedObservation(id, map(() => ({ status: 'verified_need', basis: 'direct_check' }), partsOf(id)))!
    expect(o.state).toBe('observable')
    expect(o.blocking).toEqual([])
    expect(Object.keys(o).sort()).toEqual(['blocking', 'parts', 'state', 'task'])
  })

  it.each(INTEGRATED)('%s: 하나라도 직접 확인 전 → 근거 부족(축 proxy · 기한 경과는 근거 아님)', (id) => {
    const parts = partsOf(id)
    for (const weak of ['observed', 'check_first', 'expired', 'checking'] as const) {
      const o = integratedObservation(id, map((p) => (p === parts[0] ? { status: weak, basis: weak === 'expired' || weak === 'checking' ? 'direct_check' : 'axis_proxy' } : { status: 'resolved', basis: 'direct_check' }), parts))!
      expect(o.state).toBe('insufficient')
      expect(o.blocking).toEqual([parts[0]])
    }
  })

  it.each(INTEGRATED)('%s: 하나라도 확인 도구 없음(정본 보류 · 확인 과제 없음 · 창작 없음) → 측정 불가가 근거 부족보다 먼저', (id) => {
    const parts = partsOf(id)
    const o = integratedObservation(id, map((p) => (p === parts[0] ? { status: 'unmeasurable', check: null } : p === parts[1] ? { status: 'unmeasured' } : { status: 'resolved', basis: 'direct_check' }), parts))!
    expect(o.state).toBe('unmeasurable')
    expect(o.blocking).toEqual([parts[0]])
  })

  it('As-Is 에 없는 하위 TASK = 도구 없음(측정 불가)', () => {
    const id = INTEGRATED[0]
    const parts = partsOf(id)
    const o = integratedObservation(id, map(() => ({ status: 'resolved', basis: 'direct_check' }), parts.slice(1)))!
    expect(o.state).toBe('unmeasurable')
    expect(o.parts[0]).toMatchObject({ task: parts[0], status: 'missing', evidence: 'no_instrument' })
  })
})
