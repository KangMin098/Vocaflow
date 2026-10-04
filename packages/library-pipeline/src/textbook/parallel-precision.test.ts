// packages/library-pipeline/src/textbook/parallel-precision.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { precisionPairSchema, precisionRoundSchema, summarizePrecision, validatePrecisionEvidence } from './parallel-precision'
import { researchBodyHash } from '../ingest-article/research-origin'

const data = JSON.parse(readFileSync(new URL('../../../../scripts/textbook/frym-precision/round-1.json', import.meta.url), 'utf8'))
const round = precisionRoundSchema.parse(data)
const pair = () => structuredClone(round.pairs.find((p) => p.id === 'F02')!)

describe('FYM precision review guards', () => {
  it('counts link identity and semantic alignment with independent denominators', () => {
    const summary = summarizePrecision(round.pairs)
    expect(summary.articles).toBe(20)
    expect(summary.links).toMatchObject({ verified: 20, judged: 20, accuracy: 1 })
    expect(summary.alignment).toMatchObject({ total: 22, aligned: 5, partial: 2, contradicted: 3, held: 12, judged: 10, accuracy: 0.5 })
    expect(summary.access).toEqual({ full_text: 8, abstract_only: 9, unavailable: 3 })
    // F10's correct comparator claim cannot certify its incorrect frequency claim.
    expect(summary.pairs.gold_candidates).toBe(4)
  })
  it('preserves the correct link with contradictory results and methods as negative examples', () => {
    for (const id of ['F05', 'F10', 'F13']) {
      const value = round.pairs.find((p) => p.id === id)!
      expect(value.link_review.verdict).toBe('verified')
      expect(value.alignments.some((a) => a.verdict === 'contradicted')).toBe(true)
    }
  })
  it('does not invent accuracy from absent judgments', () => {
    const value = pair()
    value.link_review.verdict = 'held'
    value.alignments = [structuredClone(round.pairs[0].alignments[0])]
    const summary = summarizePrecision([value])
    expect(summary.links.accuracy).toBeNull()
    expect(summary.alignment.accuracy).toBeNull()
    expect(summary.pairs.gold_candidates).toBe(0)
  })
  it('rejects an asserted verified link without independent bibliographic checks', () => {
    const value = pair()
    value.metadata!.doi = '10.1038/srep29517'
    expect(precisionPairSchema.safeParse(value).success).toBe(false)
    const unchecked = pair()
    unchecked.link_review.identity_checks = ['doi']
    expect(precisionPairSchema.safeParse(unchecked).success).toBe(false)
    const absent = pair()
    absent.metadata!.title = null
    absent.metadata!.authors = []
    expect(precisionPairSchema.safeParse(absent).success).toBe(false)
  })
  it('cannot promote abstract-only evidence to an aligned full-text pair', () => {
    const value = pair()
    value.research.access = 'abstract_only'
    expect(precisionPairSchema.safeParse(value).success).toBe(false)
    const unavailable = pair()
    unavailable.research.access = 'unavailable'
    expect(precisionPairSchema.safeParse(unavailable).success).toBe(false)
  })
  it('rejects missing claim evidence, inferred audience, and unassessed confidence grades', () => {
    const missing = pair()
    missing.alignments[0].original_evidence = null
    expect(precisionPairSchema.safeParse(missing).success).toBe(false)
    const age = pair()
    age.alignments[0].age_band.assessment_state = 'unassessed'
    expect(precisionPairSchema.safeParse(age).success).toBe(false)
    const confidence = pair()
    confidence.alignments[0].confidence.assessment_state = 'unassessed'
    expect(precisionPairSchema.safeParse(confidence).success).toBe(false)
  })
  it('validates exact quotes and recorded scope against hashed snapshots', () => {
    const value = pair()
    const fym = 'FYM evidence here.', research = 'Original evidence here.'
    value.source.source_hash = researchBodyHash(fym)
    value.research.hash = researchBodyHash(research)
    value.reviewed_spans = { fym: [{ start: 0, end: fym.length, section: 'Test' }], research: [{ start: 0, end: research.length, section: 'Test' }] }
    value.alignments[0].fym_evidence = { start: 0, end: fym.length, section: 'Test', quote: fym }
    value.alignments[0].original_evidence = { start: 0, end: research.length, section: 'Test', quote: research }
    value.alignments[0].omitted_detail = null
    expect(validatePrecisionEvidence(value, fym, research)).toEqual([])
    expect(validatePrecisionEvidence(value, fym + ' changed', research)).toContain('FYM hash mismatch')
    expect(validatePrecisionEvidence(value, fym, research + ' changed')).toContain('Research hash mismatch')
    value.alignments[0].original_evidence.quote = 'Invented evidence here.'
    expect(validatePrecisionEvidence(value, fym, research).join()).toContain('quote/offset mismatch')
    value.alignments[0].original_evidence.quote = research
    value.reviewed_spans.research[0].start = 5
    expect(validatePrecisionEvidence(value, fym, research).join()).toContain('outside recorded reading scope')
  })
  it('rejects duplicate pairs/alignments, screening omissions and changed origins', () => {
    const duplicate = structuredClone(data)
    duplicate.pairs.push(structuredClone(duplicate.pairs[0]))
    expect(precisionRoundSchema.safeParse(duplicate).success).toBe(false)
    const missing = structuredClone(data)
    missing.selection.screening.pop()
    expect(precisionRoundSchema.safeParse(missing).success).toBe(false)
    const changed = structuredClone(data)
    changed.pairs[0].relation = { ...changed.pairs[1].relation }
    expect(precisionRoundSchema.safeParse(changed).success).toBe(false)
    const duplicateAlignment = structuredClone(data)
    duplicateAlignment.pairs[1].alignments[0].id = duplicateAlignment.pairs[0].alignments[0].id
    expect(precisionRoundSchema.safeParse(duplicateAlignment).success).toBe(false)
  })
})
