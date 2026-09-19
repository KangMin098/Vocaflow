// apps/web/src/lib/methodology/__tests__/core.test.ts
import { describe, expect, it } from 'vitest'
import { assertBundle, compareMethods, duplicateCandidates, evidenceUrl, researchCoverage, validateBundle } from '../core'
import { researchSeed } from '../research-seed'
import { digest, parseCaptions, segmentCaptions } from '../transcript'

const seed = () => structuredClone(researchSeed)
describe('methodology provenance boundary', () => {
  it('validates actual research without promoting metadata to methods', () => {
    expect(validateBundle(seed())).toEqual([])
    expect(seed().sources.some(s => s.id.startsWith('yt:'))).toBe(true)
    expect(seed().evidence.some(e => e.sourceId.startsWith('yt:'))).toBe(false)
  })
  it('rejects unknown properties including raw transcript smuggling', () => {
    const b = { ...seed(), transcript: 'full body' }
    expect(validateBundle(b).join()).toContain('unknown field')
  })
  it('rejects malformed nested inputs without throwing a TypeError', () => {
    for (const value of [null, [], {}, { ...seed(), sources: [null], evidence: [{ locator: null }] }]) expect(() => validateBundle(value)).not.toThrow()
  })
  it('rejects metadata as evidence even if the citation looks precise', () => {
    const b = seed(); b.sources.find(s => s.id === b.evidence[0].sourceId)!.access = 'metadata_only'
    expect(validateBundle(b).join()).toContain('metadata is not claim evidence')
  })
  it('requires a source for each structural claim and the canonical wording', () => {
    const b = seed(); b.evidence = b.evidence.filter(e => e.claimId !== b.claims[0].id)
    b.methods[0].statement = 'unsupported stronger claim'
    expect(validateBundle(b).join()).toContain('supporting evidence required')
    expect(validateBundle(b).join()).toContain('canonical statement')
  })
  it('binds evidence to the reviewed source revision', () => {
    const b = seed(); b.evidence[0].sourceRevision = 'old'
    expect(validateBundle(b).join()).toContain('stale source revision')
  })
  it('does not let a cited source speak for another expert', () => {
    const b = seed(); b.evidence[0].expertIds = ['kim-jiyoung']
    expect(validateBundle(b).join()).toContain('expert not attributed')
  })
  it('rejects an out-of-range timestamp and transcript without permission', () => {
    const b = seed(); const s = b.sources.find(s => s.id === b.evidence[0].sourceId)!
    Object.assign(s, { kind: 'video', access: 'transcript_read', revision: `sha256:${'a'.repeat(64)}`, durationSeconds: 10 })
    b.evidence[0].sourceRevision = s.revision; b.evidence[0].locator = { kind: 'time', start: 5, end: 11 }
    expect(validateBundle(b).join()).toContain('time interval outside video')
    expect(validateBundle(b).join()).toContain('transcript needs permission')
  })
  it('requires review before product application', () => {
    const b = seed(); b.methods[0].productApplications = ['text']
    expect(validateBundle(b).join()).toContain('product application needs review')
    b.methods[0].review = 'reviewed'
    expect(validateBundle(b).join()).toContain('review audit required')
  })
  it('keeps independent experts, origins and efficacy separate', () => {
    const b = seed(); const original = b.evidence[0]
    b.evidence.push({ ...original, id: 'duplicate-reupload' })
    const row = compareMethods(b, [b.methods[0].id])[0]
    expect(row.consensus.expertIds).toHaveLength(1)
    expect(row.consensus.originGroups).toHaveLength(1)
    expect(row.consensus.independentlyRepeated).toBe(false)
    expect(row.consensus.efficacy).toBe('not_assessed')
  })
  it('never converts metadata inventory or drafts into reviewed coverage', () => {
    const b = seed(); const cells = researchCoverage(b)
    expect(cells.some(c => c.indexed > 0)).toBe(true)
    expect(cells.every(c => c.reviewed === 0)).toBe(true)
    expect(cells.some(c => c.extracted > 0)).toBe(true)
  })
  it('requires both sides of a proposed contradiction and preserves the relation', () => {
    const b = seed()
    b.relations.push({ id: 'conflict', fromId: b.methods[0].id, toId: b.methods[1].id, kind: 'contradicts', reason: 'test fixture only', evidenceIds: [b.evidence[0].id], review: 'extracted' })
    expect(validateBundle(b).join()).toContain('both methods')
    b.relations[0].evidenceIds.push(b.evidence.find(e => e.claimId.startsWith(b.methods[1].id))!.id)
    assertBundle(b)
    expect(compareMethods(b, [b.methods[0].id])[0].relations[0].kind).toBe('contradicts')
  })
  it('detects lexical candidates without erasing context', () => {
    const a = seed().methods[0], b = { ...a, id: 'different-age', taxonomyIds: ['age:primary'] }
    expect(duplicateCandidates([a, b])[0]).toMatchObject({ similarity: 1, contextMatches: false })
    expect(a.taxonomyIds).toContain('age:high')
  })
  it('rejects cyclic hierarchy and unsafe URLs', () => {
    const b = seed(); b.taxonomy[0].parentId = b.taxonomy[0].id; b.sources[0].url = 'javascript:alert(1)'
    expect(validateBundle(b).join()).toContain('cycle')
    expect(validateBundle(b).join()).toContain('HTTPS URL')
    expect(() => evidenceUrl(b.sources[0])).toThrow('Unsafe')
    expect(evidenceUrl({ ...seed().sources[0], kind: 'video', url: 'https://www.youtube.com/watch?v=abc' }, 90)).toContain('t=90s')
  })
})
describe('permitted transient caption pipeline', () => {
  const raw = 'WEBVTT\n\n00:00.000 --> 00:02.000\n첫 문장\n\n00:01.000 --> 00:03.000\n첫 문장 완성.\n\n00:06.000 --> 00:08.000\n다음 문장.\n'
  const permission = { analysisPermitted: true as const, basis: 'user-owned test fixture', sourceId: 'test', sourceUrl: 'https://example.org/video', sha256: digest(raw) }
  it('normalizes overlapping ASR and breaks on pauses while retaining exact positions', () => {
    const cues = parseCaptions(raw, permission)
    expect(cues).toEqual([{ start: 0, end: 3, text: '첫 문장 완성.' }, { start: 6, end: 8, text: '다음 문장.' }])
    expect(segmentCaptions(cues)[0]).toMatchObject({ start: 0, end: 3, boundary: 'pause' })
  })
  it('does not suppress intentional repetition at a later time', () => {
    const repeated = '1\n00:00:00,000 --> 00:00:02,000\nRepeat\n\n2\n00:00:04,000 --> 00:00:06,000\nRepeat'
    expect(parseCaptions(repeated, { ...permission, sha256: digest(repeated) })).toHaveLength(2)
  })
  it('refuses changed source, missing permission and empty captions', () => {
    expect(() => parseCaptions(`${raw}changed`, permission)).toThrow('hash mismatch')
    expect(() => parseCaptions(raw, { ...permission, basis: '' })).toThrow('Permission')
    expect(() => parseCaptions('', { ...permission, sha256: digest('') })).toThrow('No readable')
  })
  it('refuses oversized cues instead of silently discarding text', () => {
    expect(() => segmentCaptions([{ start: 0, end: 1, text: 'a'.repeat(81) }], 80)).toThrow('exceeds')
  })
})
