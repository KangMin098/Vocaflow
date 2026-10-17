// apps/web/src/lib/knowledge/__tests__/r5-transfer-independent.test.ts
import { expect, it } from 'vitest'
import { computeSignals, isEligible, type FirstAttempt } from '../effect-signals'
import { evidenceView } from '@/lib/csat/map/v62/evidence-claims'
import { transferContract, type ActivityRow } from '@/lib/csat/map/lifecycle-evidence'
import { transferDoneOf } from '@/lib/csat/map/v4/plan'

const transfer = (activity?: string): FirstAttempt & { activity?: string } => ({ userId: 'learner', phase: 'transfer', isCorrect: true, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false, activity })

it.each(['practice', undefined])('transfer first attempt with activity=%s cannot be independent effect evidence', (activity) => {
  const attempt = transfer(activity)
  expect(isEligible(attempt)).toBe(false)
  const signals = computeSignals({ applicationId: 'app', status: 'active', trialMinN: [], attempts: [attempt] })
  expect(signals.eligible.transfer).toBeUndefined()
  expect(signals.counts.excluded).toBe(1)
})

it('bound theater transfer needs a matching current hash, session and independent help', () => {
  const valid = { ...transfer('theater'), taskKey: 'claim-support', sessionId: 's1', contentHash: 'current', expectedContentHash: 'current' }
  expect(isEligible(valid)).toBe(true)
  for (const patch of [{ sessionId: null }, { contentHash: null }, { expectedContentHash: null }, { contentHash: 'old' }, { helpLevel: 'hint' }, { activity: 'unknown' }]) expect(isEligible({ ...valid, ...patch })).toBe(false)
})

it('G2 practice transfer remains T4 experience and PLAN workload, never independent achievement', () => {
  const rows: ActivityRow[] = [1, 2].map((n) => ({ attemptId: String(n), itemRef: `i${n}`, taskKey: 'claim-support', phase: 'transfer', isCorrect: true, answeredAt: '2026-10-17T00:00:00Z', receivedAt: '2026-10-17T00:00:01Z', activity: 'practice', helpLevel: 'independent', contentHash: 'current', passageKey: `passage${n}` }))
  const done = transferDoneOf('r.central_meaning', '2026-10-16T00:00:00Z', [...rows, rows[0]!])
  expect(done).toBe(2)
  const view = evidenceView({ task: 'r.central_meaning', check: null, activity: rows, firsts: rows.map((r) => ({ ...transfer('practice'), attemptId: r.attemptId, itemRef: r.itemRef!, taskKey: r.taskKey })), hashes: { 'claim-support|i1': 'current', 'claim-support|i2': 'current' }, transfer: { done, planned: 2 } })
  expect(view.currentCheck.independentItems).toBe(0)
  expect(view.attempts.every((a) => a.fields.independence === 'INELIGIBLE' && a.claim !== 'independent_check')).toBe(true)
  expect(view.newPassageTransfer).toEqual({ status: 'experienced', passages: 2 })
  expect(view.learningEffect).toBe('NOT_EVALUATED')
  expect(transferContract(rows[0]!.answeredAt, done, 2)).toMatchObject({ evidence: 'experience_only', ready: true, progress: { done: 2, planned: 2 } })
})
