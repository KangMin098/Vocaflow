// apps/web/src/lib/csat/map/v62/__tests__/goal-context.test.ts
import { expect, it } from 'vitest'
import { draftKey } from '@/components/csat/diagnosis/map/PlanSection'
import { parseCommitRequest, requestSignature, sameCommitRequest } from '../../v4/plan-commit'

const base = { template: 'ws.central-meaning', order: ['r.central_meaning' as const], planned: {}, reason: 'initial' as const, expectedVersion: 0, clientKey: '10000000-0000-4000-8000-000000000001' }
it('same score but different goal versions have distinct draft and acknowledgement keys', () => {
  expect(draftKey('owned', 'ws.central-meaning', 80, 1, 10)).not.toBe(draftKey('owned', 'ws.central-meaning', 80, 1, 11))
})
it('accepts explicit observed goal version and rejects invalid values', () => {
  for (const expectedGoalVersion of [null, 10]) expect(parseCommitRequest({ ...base, expectedGoalVersion })).toMatchObject({ ok: true })
  for (const expectedGoalVersion of [0, -1, 1.5, '10']) expect(parseCommitRequest({ ...base, expectedGoalVersion })).toMatchObject({ ok: false })
})
it('goal-version changes create a different request identity even at the same score', () => {
  expect(requestSignature({ ...base, expectedGoalVersion: 10 })).not.toBe(requestSignature({ ...base, expectedGoalVersion: 11 }))
})
it('replay must retain the originally observed goal version, while legacy requests remain compatible', () => {
  const prior = { template: base.template, version: 1, workspaceId: 'owned', plan: { order: base.order, tasks: [{ task: base.order[0], stage: 'check', planned: null, available: 9, rule: null }] }, reason: base.reason, note: null, restoredFrom: null, goalVersionId: 10 }
  expect(sameCommitRequest(prior, { ...base, expectedGoalVersion: 10 })).toBe(true)
  expect(sameCommitRequest(prior, { ...base, expectedGoalVersion: 11 })).toBe(false)
  expect(sameCommitRequest(prior, base)).toBe(true)
})
