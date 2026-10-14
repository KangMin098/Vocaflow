// apps/web/src/lib/csat/map/v4/__tests__/plan-retry.test.ts
// v6.2 P-M2b — 같은 clientKey 재전송 판정(순수). 같으면 처음 결과 재사용, 다르면 충돌. 지금 다시 계산한 가용량 · 단계는 보지 않는다.
import { describe, expect, it } from 'vitest'

import { sameCommitRequest, type PlanCommitRequest, type PriorCommit } from '../plan-commit'

const prior: PriorCommit = {
  template: 'ws.central-meaning',
  version: 2,
  workspaceId: 'w',
  plan: { order: ['r.central_meaning', 'r.discourse_function'], tasks: [{ task: 'r.central_meaning', stage: 'check', planned: 3, available: 5, rule: null }, { task: 'r.discourse_function', stage: null, planned: null, available: null, rule: null }] },
  reason: 'learner_adjust',
  note: ' 이번 주 ',
  restoredFrom: null,
}
const req = (over: Partial<PlanCommitRequest> = {}): PlanCommitRequest => ({ template: 'ws.central-meaning', order: ['r.central_meaning', 'r.discourse_function'], planned: { 'r.central_meaning': 3 }, reason: 'learner_adjust', note: '이번 주', expectedVersion: 1, clientKey: 'k', ...over })

describe('같은 clientKey 재전송', () => {
  it('같은 요청이면 재사용(메모 앞뒤 공백 · 빠진 계획량 = null 은 같다)', () => {
    expect(sameCommitRequest(prior, req())).toBe(true)
  })
  it('본문이 하나라도 다르면 충돌', () => {
    expect(sameCommitRequest(prior, req({ note: '다른 메모' }))).toBe(false)
    expect(sameCommitRequest(prior, req({ planned: { 'r.central_meaning': 2 } }))).toBe(false)
    expect(sameCommitRequest(prior, req({ order: ['r.discourse_function', 'r.central_meaning'] }))).toBe(false)
    expect(sameCommitRequest(prior, req({ reason: 'initial' }))).toBe(false)
    expect(sameCommitRequest(prior, req({ template: 'ws.option-match' }))).toBe(false)
    expect(sameCommitRequest(prior, req({ expectedVersion: 0 }))).toBe(false)
    expect(sameCommitRequest(prior, req({ planned: { 'r.central_meaning': 3, 'e.x': 1 } }))).toBe(false)
  })
  it('지금 가용량 · 단계가 바뀌어도(서버 재계산 값) 같은 요청이면 재사용 — 콘텐츠 자격 변경이 성공한 재시도를 막지 않는다', () => {
    const changed = { ...prior, plan: { ...prior.plan, tasks: prior.plan.tasks.map((t) => ({ ...t, available: 0, stage: 'recheck' })) } }
    expect(sameCommitRequest(changed, req())).toBe(true)
  })
  it('되돌리기는 되돌린 버전까지 같아야 한다', () => {
    const r = { ...prior, reason: 'restore' as const, restoredFrom: 1 }
    expect(sameCommitRequest(r, req({ reason: 'restore', restoreOf: 1 }))).toBe(true)
    expect(sameCommitRequest(r, req({ reason: 'restore', restoreOf: 2 }))).toBe(false)
  })
})
