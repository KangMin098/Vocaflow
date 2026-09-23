// packages/library-pipeline/src/textbook/source-policy.test.ts
import { describe, expect, it } from 'vitest'
import { evaluateSource, isComposable, type SourceEligibilityInput } from './source-eligibility'

const good: SourceEligibilityInput = {
  title: 'Coastal wetlands', status: 'ready', articleVLevel: 5, wordCount: 150,
  register: 'expository', cefrLevel: 'B2', syntaxScore: 70, displayOnly: false,
  licenseClass: 'cc_by', copyrightSafeInKr: true, gatePublishable: true,
  gateBlockedBy: null, gateVerdict: 'use', gatePurpose: 'csat', excerptWindows: null,
}
describe('canonical source policy', () => {
  it.each(['raw', 'csat', 'library', 'kids'])('reject cannot escape through %s', gatePurpose => {
    for (const gatePublishable of [true, false, null]) {
      const result = evaluateSource({ ...good, gatePurpose, gatePublishable, gateVerdict: 'reject',
        gateBlockedBy: 'oversize-raw', wordCount: 4000, hasItems: true })
      expect(result.blockers).toContain('content_rejected')
      expect(result.status).toBe('rejected')
      expect(isComposable(result.grade)).toBe(false)
    }
  })
  it.each(['textbook', 'learner'] as const)('%s uses the existing CEFR policy', context => {
    expect(evaluateSource({ ...good, cefrLevel: 'C1' }, context).blockers).toContain('cefr_above_band')
    expect(evaluateSource({ ...good, articleVLevel: 4 }, context).grade).toBe('blocked')
    expect(evaluateSource({ ...good, articleVLevel: 4, cefrLevel: 'B1' }, context).status).toBe('eligible')
  })
  // 2026-09-23 결정: 길이는 원문 적격 기준이 아니다 — 발췌는 교재 생성 단계의 별도 공정이고
  // 유형마다 창이 다르다. `excerptStatus` 는 그대로 남지만 **차단이 아니라 관찰**이다.
  it('length is observed, not gated; excerptStatus still tells the excerpt queue apart', () => {
    const input = { ...good, wordCount: 3000, excerptWindows: 5 }
    expect(evaluateSource(input)).toMatchObject({ grade: 'usable', excerptStatus: 'candidate' })
    expect(evaluateSource({ ...input, hasItems: true })).toMatchObject({ grade: 'usable', excerptStatus: 'item-linked' })
    expect(evaluateSource({ ...input, excerptWindows: null })).toMatchObject({ grade: 'usable', excerptStatus: 'missing' })
    expect(evaluateSource(input).blockers).not.toContain('excerpt_not_materialized')
  })
  it.each([{ syntaxScore: NaN }, { articleVLevel: 12 }, { cefrLevel: 'X' }, { wordCount: -1 }])('invalid analysis never passes: %j', bad => {
    const r = evaluateSource({ ...good, ...bad })
    expect(r.analysisStatus).toBe('invalid')
    expect(isComposable(r.grade)).toBe(false)
  })
  it.each([{ syntaxScore: null }, { gateVerdict: null }, { gatePublishable: null }, { status: 'archived' }])('incomplete inputs never pass: %j', bad => {
    expect(isComposable(evaluateSource({ ...good, ...bad }).grade)).toBe(false)
  })
  it('a harmful genre cannot escape under use', () => {
    expect(evaluateSource({ ...good, gateGenre: 'pseudoscience' }).blockers).toContain('harmful_genre')
  })
  it('every consumer gets reasons; blockers and eligible are mutually exclusive', () => {
    for (const gateVerdict of ['use', 'reject', 'narrative', null]) {
      for (const hasItems of [true, false]) for (const cefrLevel of ['B1', 'C1', null]) {
        const r = evaluateSource({ ...good, gateVerdict, hasItems, cefrLevel })
        expect(r.reasons.length).toBeGreaterThan(0)
        expect(isComposable(r.grade)).toBe(r.blockers.length === 0)
      }
    }
  })
})
