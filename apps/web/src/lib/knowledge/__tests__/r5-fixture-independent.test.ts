// apps/web/src/lib/knowledge/__tests__/r5-fixture-independent.test.ts
import { expect, it } from 'vitest'
import { annotationFor, gradeClaimSupport } from '../claim-support'
import { gradePractice, keyFromAnnotation } from '../practice'

it('2022 answer cannot grade a substituted 2020#24 item — original E2E counterexample', () => {
  const answer = { claim: 1, support: [3, 4], relation: 'reason' as const, option: 5, confidence: 3 as const }
  const legacy = gradePractice(gradeClaimSupport, keyFromAnnotation(annotationFor('2022#20')!), answer)
  const selected = gradePractice(gradeClaimSupport, keyFromAnnotation(annotationFor('2020#24')!), answer)
  expect(legacy.isCorrect).toBe(true)
  expect(selected.isCorrect).toBe(false)
})
