// apps/web/src/lib/knowledge/__tests__/contextual-sense-acceptance.test.ts
import { describe, expect, it } from 'vitest'

import { indexContextualSenseAnnotations, releasable, type ContextualSenseAnnotation } from '../contextual-sense'

const a = (): ContextualSenseAnnotation => ({ version: 'test.v1', itemId: 'T#30', skeletonSig: 'sig', sentenceCount: 8,
  sourceRevision: 'a'.repeat(64), officialAnswer: 4, targets: [1, 2, 3, 5, 6], misfit: 3,
  sense: { options: ['decrease', 'increase'], correct: 0, rejectWhy: { 1: 'declining context' } },
  cue: { sentences: [4], accepted: [], reviewed: true },
  review: { status: 'accepted', annotator: 'A', independentReviewer: 'B', reviewerBlind: true, agreement: 'B+D agreed', reviewedAt: '2026-10-17' } })

describe('V2 release metadata is necessary, not proof of actual blind review', () => {
  it('rejects self review, missing actors/agreement/date and nonboolean blind claims', () => {
    expect(releasable(a())).toBe(true)
    for (const patch of [{ independentReviewer: ' A ' }, { annotator: ' ' }, { agreement: null }, { reviewedAt: 'not-a-date' }, { reviewerBlind: 'true' }]) {
      expect(releasable({ ...a(), review: { ...a().review, ...patch } })).toBe(false)
    }
  })
  it('requires source digest and official answer consistency before release eligibility', () => {
    for (const patch of [{ sourceRevision: undefined }, { sourceRevision: 'sig' }, { officialAnswer: 1 }, { officialAnswer: undefined }]) expect(releasable({ ...a(), ...patch })).toBe(false)
  })
  it('fails closed for duplicate versions, conflicting judgments and accepted/draft collisions', () => {
    expect(indexContextualSenseAnnotations([a()])['T#30']).toBeTruthy()
    for (const other of [a(), { ...a(), version: 'test.v2' }, { ...a(), review: { ...a().review, status: 'draft' } }]) expect(indexContextualSenseAnnotations([a(), other])).toEqual({})
  })
})
