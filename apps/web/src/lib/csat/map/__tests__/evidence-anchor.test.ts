// apps/web/src/lib/csat/map/__tests__/evidence-anchor.test.ts
// 계약 B — Evidence Anchor 안정성 · 원문 변경 무효화
import { describe, expect, it } from 'vitest'

import { anchorSentence, checkAnchor, normalizeText, sourceHash, textHash, usableForItemEvidence, type EvidenceAnchor, type SourceSnapshot } from '../evidence-anchor'

const src: SourceSnapshot = {
  sourceRevision: 'r1',
  segmentationVersion: 'seg-1',
  sentences: ['Cats sleep a lot.', 'Dogs bark loudly.', 'Birds sing early.'],
}
const base = { sourceId: 'csat:2022', itemId: '2022#20', anchorType: 'passage' as const, evidenceType: 'task_annotation' as const, judgmentRevision: 'j1' }

describe('정규화 · 해시', () => {
  it('공백 · 줄바꿈 · 굽은 따옴표만 다른 문장은 같은 해시', () => {
    expect(textHash('He said “yes”  and\nleft.')).toBe(textHash('He said "yes" and left.'))
  })
  it('대소문자 · 구두점이 다르면 다른 해시', () => {
    expect(textHash('Dogs bark.')).not.toBe(textHash('dogs bark.'))
    expect(textHash('Dogs bark.')).not.toBe(textHash('Dogs bark!'))
  })
  it('길이가 같은 서로 다른 문장은 다른 근거다', () => {
    const a = 'Cats sleep a lot.', b = 'Bats sleep a lot.'
    expect(a.length).toBe(b.length)
    expect(textHash(a)).not.toBe(textHash(b))
  })
  it('normalizeText 는 앞뒤 공백을 지운다', () => expect(normalizeText('  a  b ')).toBe('a b'))
  it('본문 해시는 문장 경계도 묶는다', () => {
    expect(sourceHash(['a b.', 'c.'])).not.toBe(sourceHash(['a', 'b. c.']))
  })
})

describe('대조 · 무효화', () => {
  const a = anchorSentence(base, src, 1)
  it('같은 본문 → valid · 처음 만든 앵커는 legacy_candidate(자동 승격 없음)', () => {
    expect(checkAnchor(a, src)).toEqual({ status: 'valid' })
    expect(a.validationStatus).toBe('legacy_candidate')
    expect(usableForItemEvidence(a, src)).toBe(false)
  })
  it('validated 로 올렸어도 정본 단위 id 또는 문자 범위가 있어야 문항 근거로 쓴다(유일 좌표)', () => {
    expect(usableForItemEvidence({ ...a, validationStatus: 'validated_anchor' }, src)).toBe(false)
    expect(usableForItemEvidence({ ...a, validationStatus: 'validated_anchor', unitId: 'u-1' }, src)).toBe(true)
  })
  it('문장은 그대로여도 주변 문맥 · revision · 판정 revision 이 바뀌면 context_changed(재검토)', () => {
    const ctx = { ...src, sentences: ['Cats nap a lot.', 'Dogs bark loudly.', 'Birds sing early.'] }
    expect(checkAnchor(a, ctx)).toEqual({ status: 'context_changed' })
    expect(checkAnchor(a, { ...src, sourceRevision: 'r2' })).toEqual({ status: 'context_changed' })
    expect(checkAnchor(a, src, 'j2')).toEqual({ status: 'context_changed' })
    expect(usableForItemEvidence({ ...a, validationStatus: 'reviewed_anchor', unitId: 'u-1' }, ctx)).toBe(false)
  })
  it('프라임 기호는 따옴표로 바꾸지 않는다(단위 · 기호 뜻 보존)', () => {
    expect(textHash('5\u2032 3\u2033')).not.toBe(textHash('5\' 3"'))
  })
  it('앞에 문장이 끼어 위치가 바뀌면 relocated(재검토 · 자동 승격 아님)', () => {
    const moved = { ...src, sentences: ['New first.', ...src.sentences] }
    expect(checkAnchor(a, moved)).toEqual({ status: 'relocated', index: 2 })
    expect(usableForItemEvidence({ ...a, validationStatus: 'reviewed_anchor', unitId: 'u-1' }, moved)).toBe(false)
  })
  it('같은 문장이 두 번 나오면 ambiguous(보류)', () => {
    const dup = { ...src, sentences: ['Dogs bark loudly.', ...src.sentences] }
    expect(checkAnchor(a, dup)).toEqual({ status: 'ambiguous', indexes: [0, 2] })
  })
  it('문장 텍스트가 바뀌면(같은 길이여도) stale', () => {
    const changed = { ...src, sentences: ['Cats sleep a lot.', 'Hogs bark loudly.', 'Birds sing early.'] }
    expect(changed.sentences[1].length).toBe(src.sentences[1].length)
    expect(checkAnchor(a, changed)).toEqual({ status: 'stale', reason: 'text_missing' })
  })
  it('분할 · 정규화 버전이 바뀌면 stale', () => {
    expect(checkAnchor(a, { ...src, segmentationVersion: 'seg-2' })).toEqual({ status: 'stale', reason: 'segmentation_changed' })
    expect(checkAnchor({ ...a, normalizationVersion: 'anchor-norm-0' }, src)).toEqual({ status: 'stale', reason: 'normalization_changed' })
  })
  it('원문 해시가 없는 앵커(경계 서명만)는 원문 검증이 아니다', () => {
    const legacy: EvidenceAnchor = { ...a, sourceTextHash: null }
    expect(checkAnchor(legacy, src)).toEqual({ status: 'boundary_only' })
    expect(usableForItemEvidence({ ...legacy, validationStatus: 'validated_anchor' }, src)).toBe(false)
  })
  it('없는 문장 번호로는 앵커를 만들지 않는다', () => {
    expect(() => anchorSentence(base, src, 9)).toThrow()
  })
})
