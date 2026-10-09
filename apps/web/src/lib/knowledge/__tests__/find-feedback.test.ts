// apps/web/src/lib/knowledge/__tests__/find-feedback.test.ts
// 계약 C — FIND 결과 → 진단 환류: basis 를 바꾸지 않고 순서 · 다음 행동만
import { describe, expect, it } from 'vitest'

import { findFeedback, orderFindTasks } from '../find-feedback'

describe('findFeedback', () => {
  it('확인된 학습 요구 → 기본은 직접 진단 대기(정본 §14) · 맨 위', () => {
    expect(findFeedback({ state: 'confirmed_need', needsMoreItems: false })).toMatchObject({ nextAction: 'await_direct_diagnosis', order: 3 })
  })
  it('결정 D-7 이 허용하면 같은 원리 Practice', () => {
    expect(findFeedback({ state: 'confirmed_need', needsMoreItems: false }, { allowPracticeBeforeVerified: true }).nextAction).toBe('practice_principle')
  })
  it('확인 문항이 0개면 어떤 상태든 준비 중(없는 문항을 요구하지 않는다)', () => {
    expect(findFeedback({ state: 'untried', needsMoreItems: true, targets: 0 }).nextAction).toBe('await_items')
  })
  it('필요 없음 → 다음 단계 · 맨 아래', () => {
    expect(findFeedback({ state: 'not_needed', needsMoreItems: false })).toMatchObject({ nextAction: 'next_step', order: 0 })
  })
  it('섞임 · 확인 중 → 한 문항 더 · 확인 문항이 모자라면 준비 중', () => {
    expect(findFeedback({ state: 'mixed', needsMoreItems: false }).nextAction).toBe('confirm_more')
    expect(findFeedback({ state: 'in_progress', needsMoreItems: false }).nextAction).toBe('confirm_more')
    expect(findFeedback({ state: 'in_progress', needsMoreItems: true }).nextAction).toBe('await_items')
    expect(findFeedback({ state: 'untried', needsMoreItems: false, targets: 2 }).nextAction).toBe('confirm_more')
  })
  it('어떤 결과도 진단 basis 를 바꾸지 않고 우선 확인 후보에 넣지 않는다(계약 C-1 · D-2 결정 전)', () => {
    for (const state of ['untried', 'in_progress', 'confirmed_need', 'not_needed', 'mixed'] as const) {
      const f = findFeedback({ state, needsMoreItems: false })
      expect(f.changesDiagnosisBasis).toBe(false)
      expect(f.prioritySignal).toBe(false)
    }
  })
})

describe('orderFindTasks', () => {
  it('확인된 학습 요구 먼저 · 필요 없음 마지막 · 같은 무게는 원래 순서', () => {
    const tasks = ['a', 'b', 'c', 'd']
    const st: Record<string, 'confirmed_need' | 'not_needed' | 'untried' | null> = { a: 'not_needed', b: null, c: 'confirmed_need', d: 'untried' }
    const out = orderFindTasks(tasks, (t) => (st[t] ? findFeedback({ state: st[t]!, needsMoreItems: false }) : null))
    expect(out).toEqual(['c', 'b', 'd', 'a'])
  })
})
