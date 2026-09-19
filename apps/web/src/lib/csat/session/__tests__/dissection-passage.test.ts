// apps/web/src/lib/csat/session/__tests__/dissection-passage.test.ts
import { describe, expect, it } from 'vitest'
import { buildDissectionPassage } from '../../dissection-passage'

describe('shared verified phrase anchors', () => {
  const passage = 'The claim stays true.'
  const skeleton = { sentences: [passage.length], anchors: [{ id: 'answer', from: 'answer' as const, sentences: [0], quotes: [], spans: [{ sentence: 0, start: 4, end: 9 }] }] }
  it('connects a verified phrase to the exact reflow sentence', () => {
    const model = buildDissectionPassage(passage, skeleton)
    expect(model.sentences[0].marks[0].ranges).toEqual([{ start: 4, end: 9 }])
    expect(passage.slice(4, 9)).toBe('claim')
  })
  it('keeps sentence-level evidence when the source length no longer matches', () => {
    const model = buildDissectionPassage('A changed source sentence.', skeleton)
    expect(model.sentences[0].marks[0].ranges).toEqual([])
  })
  it('does not manufacture highlights from malformed or out-of-bounds spans', () => {
    for (const span of [{ sentence: 0, start: -1, end: 9 }, { sentence: 0, start: 4, end: 99 }, { sentence: 0, start: 9, end: 4 }]) {
      const model = buildDissectionPassage(passage, { ...skeleton, anchors: [{ ...skeleton.anchors[0], spans: [span] }] })
      expect(model.sentences[0].marks[0].ranges).toEqual([])
    }
  })
})
