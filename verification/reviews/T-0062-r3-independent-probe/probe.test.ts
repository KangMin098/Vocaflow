// verification/reviews/T-0062-independent-probe/probe.test.ts
import { describe, expect, it } from 'vitest'
import { returnRecap, LATEST_LABEL } from '@/lib/csat/map/v62/return-recap'
import { returnSummary } from '@/lib/csat/map/v62/learner-guide'
import { applyAuthoredBindings } from '@/lib/csat/authored/evidence'
import { recapFor } from '@/components/csat/diagnosis/map/TaskInspector'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

const key = 'authored-evidence-locate'
const attempt = (o: Partial<FindAttemptRow> = {}): FindAttemptRow => ({
  userId: 'synthetic-fixture-user', itemRef: 'authored:ev-ind-1', taskKey: key,
  attemptId: '63', phase: 'practice', isCorrect: false, synthetic: false,
  helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false,
  timingUncertain: false, answeredAt: '2026-10-20T01:00:00.000Z', activity: 'theater',
  sessionId: 'session-a', contentHash: 'hash-a', expectedContentHash: 'hash-a', ...o,
})
const input = { activityAttempt: '63', activityRef: 'authored:ev-ind-1', keys: [key], attempts: [] as FindAttemptRow[], activity: [], transfer: undefined, history: [], proposalDiffers: false }
const latest = (a: FindAttemptRow) => returnRecap({ ...input, attempts: [a] }).latest
const label = (a: FindAttemptRow) => {
  const r = latest(a)
  return r.state === 'found' ? LATEST_LABEL[r.kind] : r.state
}

describe('independent factual controls', () => {
  it('a genuine independent incorrect first attempt is counted', () => {
    expect(latest(attempt())).toMatchObject({ state: 'found', kind: 'independent_counted', isCorrect: false })
  })
  it('actual prior explanation and uncertain timing remain excluded', () => {
    expect(latest(attempt({ afterExplanation: true }))).toMatchObject({ kind: 'not_counted_helped' })
    expect(latest(attempt({ timingUncertain: true }))).toMatchObject({ kind: 'not_counted_timing' })
  })
})

describe('T0062-F4: exclusion is not proof of help', () => {
  it('synthetic-only exclusion must not invent prior help or explanation', () => {
    expect(label(attempt({ synthetic: true }))).not.toContain('도움 · 해설을 본 뒤')
  })
  it('unknown help level must not invent prior help or explanation', () => {
    expect(label(attempt({ helpLevel: null }))).not.toContain('도움 · 해설을 본 뒤')
  })
  it('unreadable delivery binding must remain unverified, not proven help', () => {
    const [gated] = applyAuthoredBindings([attempt()], null)
    expect(label(gated)).not.toContain('도움 · 해설을 본 뒤')
  })
})

it('T0062-F2: a failed lifecycle read stays unknown through actual recapFor wiring', () => {
  const r = recapFor('e.task_demand', {
    evidence: { 'e.task_demand': { ledger: 'unknown', instructionPath: { transferDone: 0, transferPlanned: 2 } } },
  } as never, { findAttempts: [], lifecycleActivity: undefined } as never, null)
  expect(r.transfer.state).toBe('unknown')
})

it('T0062-F3: a saved PLAN must not be relabelled with the changed current goal', () => {
  const history = [{ version: 3, reason: 'check_result', goalVersionId: 10,
    plan: { order: [], tasks: [] }, note: null, restoredFrom: null, canon: 'fixture', asOf: '', createdAt: '' }]
  const recap = returnRecap({ ...input, history: history as never, proposalDiffers: true })
  const text = returnSummary({ check: null, taskDisplay: 'E1', recap, remaining: 'fixture', nextLabel: null,
    notes: [], planVersion: 3, goalVersion: 11 }).join('\n')
  const saved = text.split('\n').find(x => x.includes('저장한 학습계획 v3'))
  expect(saved).not.toContain('목표 v11')
  expect(saved).toContain('목표 v10')
})

it('F1 control: another material in the same TASK must not replace the returned material', () => {
  const other = attempt({ itemRef: 'authored:ev-ind-2', attemptId: '64', isCorrect: true, answeredAt: '2026-10-20T02:00:00.000Z' })
  expect(returnRecap({ ...input, attempts: [attempt(), other] }).latest).toMatchObject({ state: 'found', isCorrect: false })
})

it('F1 controls: absent context and a foreign/unmatched material stay unidentified', () => {
  expect(returnRecap({ ...input, activityRef: null, attempts: [attempt()] }).latest.state).toBe('unidentified')
  expect(returnRecap({ ...input, activityRef: 'authored:someone-else', attempts: [attempt()] }).latest.state).toBe('unidentified')
})

it('F1 residual: one material with two guided attempts does not identify this return attempt', () => {
  const guided = (attemptId: string, isCorrect: boolean, answeredAt: string) => ({
    attemptId, itemRef: 'authored:ev-guided-1', taskKey: key, phase: 'practice', activity: 'practice', isCorrect, answeredAt,
  })
  const r = returnRecap({ ...input, activityAttempt: null, activityRef: 'authored:ev-guided-1', attempts: [], activity: [
    guided('71', false, '2026-10-20T01:00:00.000Z'),
    guided('72', true, '2026-10-20T02:00:00.000Z'),
  ] as never })
  // Both result links carry only the same map_item. Neither identifies which attempt is being returned from.
  // The latest material result may be shown separately, but cannot be asserted as this return's attempt.
  expect(r.latest.state).toBe('unidentified')
})

it('F1 fixed: two tabs on the same guided material select their actual saved attempts', () => {
  const activity = [
    { attemptId: '71', itemRef: 'authored:ev-guided-1', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: false, answeredAt: '2026-10-20T01:00:00.000Z' },
    { attemptId: '72', itemRef: 'authored:ev-guided-1', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: true, answeredAt: '2026-10-20T02:00:00.000Z' },
  ] as never
  const base = { ...input, attempts: [], activity, activityRef: 'authored:ev-guided-1' }
  expect(returnRecap({ ...base, activityAttempt: '71' }).latest).toMatchObject({ state: 'found', isCorrect: false })
  expect(returnRecap({ ...base, activityAttempt: '72' }).latest).toMatchObject({ state: 'found', isCorrect: true })
  expect(returnRecap({ ...base, activityAttempt: '999' }).latest.state).toBe('unidentified')
  expect(returnRecap({ ...base, activityAttempt: '71', activityRef: 'authored:other-item' }).latest.state).toBe('unidentified')
})
