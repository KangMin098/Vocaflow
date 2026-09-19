// apps/web/src/lib/csat/dissection-passage.ts
import type { DissectionItem } from './dissect'
import { buildPassageModel } from './session/passage-model'

/** The same verified phrase ranges serve prediction, visual analysis and speech focus. */
export function buildDissectionPassage(passage: string, skeleton: DissectionItem['skeleton']) {
  const result = buildPassageModel(passage, skeleton)
  for (const anchor of skeleton.anchors) for (const span of anchor.spans ?? []) {
    const sentence = result.sentences.find(s => s.skeleton.length === 1 && s.skeleton[0] === span.sentence && s.text.length === skeleton.sentences[span.sentence])
    const mark = sentence?.marks.find(m => m.anchorId === anchor.id)
    if (mark && sentence && Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= sentence.text.length) mark.ranges.push({ start: span.start, end: span.end })
  }
  return result
}
