// apps/web/src/lib/csat/map/v62/__tests__/evidence-claims-independent.test.ts
import { describe, expect, it } from 'vitest'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import type { ActivityRow } from '../../lifecycle-evidence'
import { checkKeysOfTask } from '../../v4/definition'
import { evidenceView, type EvidenceInput } from '../evidence-claims'

const key = checkKeysOfTask('r.central_meaning')[0]!
type First = FindAttemptRow & { attemptId?: string }
type Act = ActivityRow & { attemptId?: string }
const first = (o: Partial<First> = {}): First => ({ attemptId: '1', userId: 'u', itemRef: 'i1', taskKey: key, phase: 'practice', isCorrect: false, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: '2026-10-01T00:00:00Z', activity: 'theater', ...o })
const act = (o: Partial<Act> = {}): Act => ({ attemptId: '1', itemRef: 'i1', taskKey: key, phase: 'practice', isCorrect: false, answeredAt: '2026-10-01T00:00:00Z', contentHash: 'current', activity: 'theater', helpLevel: 'independent', synthetic: false, receivedAt: '2026-10-01T00:00:01Z', ...o })
const run = (o: Partial<EvidenceInput> = {}) => evidenceView({ task: 'r.central_meaning', check: null, firsts: [first()], activity: [act()], hashes: { [`${key}|i1`]: 'current' }, transfer: { done: 0, planned: 2 }, ...o })
const retry = (o: Partial<Act> = {}) => act({ attemptId: '2', isCorrect: true, answeredAt: '2026-10-02T00:00:00Z', receivedAt: '2026-10-02T00:00:01Z', ...o })

describe('independent T4 lineage counterexamples', () => {
 it('A first wrong, next-day correct: exact original row is the independent observation', () => {
  const v = run({ activity: [retry(), act()] })
  expect(v.attempts.map(a => a.fields.independence)).toEqual(['NOT_APPLICABLE', 'CONFIRMED'])
  expect(v.attempts[1]!.claim).toBe('independent_check')
  expect((v.attempts[1] as unknown as { outcome: string }).outcome).toBe('incorrect')
 })
 it('B helped first never lends its eligibility to the newest retry', () => {
  const v = run({ firsts: [first({ helpLevel: 'viewed_first', afterViewedFirst: true })], activity: [retry(), act({ helpLevel: 'viewed_first' })] })
  expect(v.attempts.map(a => a.fields.independence)).toEqual(['NOT_APPLICABLE', 'INELIGIBLE'])
 })
 it('C independent first remains that row after a helped retry', () => {
  const v = run({ activity: [retry({ helpLevel: 'viewed_first' }), act()] })
  expect(v.attempts.map(a => a.fields.independence)).toEqual(['INELIGIBLE', 'CONFIRMED'])
 })
 it.each([
  ['submission order differs from id order', '9', '2026-10-03T00:00:00Z'],
  ['same submitted timestamp', '2', '2026-10-01T00:00:00Z'],
 ])('D/E %s: do not elect another first attempt', (_name, id, at) => {
  const v = run({ activity: [retry({ attemptId: id, answeredAt: at }), act()] })
  expect(v.attempts[0]!.fields.independence).toBe('NOT_APPLICABLE')
  expect(v.attempts[1]!.fields.independence).toBe('CONFIRMED')
 })
 it('F phase binding prevents a pre/transfer record borrowing the practice first', () => {
  const v = run({ activity: [retry({ phase: 'transfer', attemptId: '1' }), act()] })
  expect(v.attempts[0]!.fields.independence).toBe('NOT_APPLICABLE')
  expect(v.attempts[1]!.fields.independence).toBe('CONFIRMED')
 })
 it('G other task and same item cannot borrow the first row', () => {
  expect(run({ activity: [act({ taskKey: 'other' })] }).attempts).toEqual([])
  expect(run({ activity: [act({ taskKey: key + '-skeleton' })] }).attempts[0]!.fields.independence).not.toBe('CONFIRMED')
 })
 it.each(['first', 'activity', 'both'])('missing %s attempt id is UNKNOWN, not a newly elected first', which => {
  const v = run({ firsts: [first({ attemptId: which === 'activity' ? '1' : undefined })], activity: [act({ attemptId: which === 'first' ? '1' : undefined })] })
  expect(v.attempts[0]!.fields.independence).toBe('UNKNOWN')
  expect(v.attempts[0]!.claim).toBe('held')
 })
 it('same id with conflicting first correctness is held, not cross-joined', () => {
  expect(run({ activity: [act({ isCorrect: true })] }).attempts[0]!.fields.independence).toBe('UNKNOWN')
 })
 it.each([undefined, null, 'missing'])('unknown current annotation %s never yields condition success', hash => {
  const v = run({ firsts: [], activity: [act({ phase: 'transfer', isCorrect: true })], hashes: hash === undefined ? undefined : hash === 'missing' ? {} : { [`${key}|i1`]: hash } })
  expect(v.attempts[0]!.fields.performed).toBe('CONFIRMED')
  expect(v.attempts[0]!.fields.correct).toBe('CONFIRMED')
  expect(v.attempts[0]!.fields.instrument).toBe('UNKNOWN')
  expect(v.attempts[0]!.claim).toBe('performed_only')
 })
 it.each([null, undefined])('missing recorded hash %s never yields success', contentHash => {
  expect(run({ activity: [act({ phase: 'transfer', isCorrect: true, contentHash })] }).attempts[0]!.claim).toBe('performed_only')
 })
 it('known stale annotation retains the original correct observation without current success', () => {
  const a = run({ activity: [act({ phase: 'transfer', isCorrect: true, contentHash: 'old' })] }).attempts[0]!
  expect(a.fields.instrument).toBe('STALE'); expect(a.claim).toBe('performed_only')
 })
 it('known matching annotation supports condition success without claiming independence', () => {
  expect(run({ activity: [act({ phase: 'transfer', isCorrect: true })] }).attempts[0]!.claim).toBe('condition_success')
 })
 it('confirmed prior help outranks timing uncertainty and practice screen is ineligible', () => {
  expect(run({ firsts: [first({ afterExplanation: true, timingUncertain: true })] }).attempts[0]!.fields.independence).toBe('INELIGIBLE')
  expect(run({ firsts: [first({ activity: 'practice' })], activity: [act({ activity: 'practice' })] }).attempts[0]!.fields.independence).toBe('INELIGIBLE')
 })
 it('missing ledger differs from a complete zero-row ledger', () => {
  expect(run({ firsts: undefined }).ledger).toBe('unknown')
  expect(run({ firsts: [], activity: [] }).ledger).toBe('complete')
 })
})
