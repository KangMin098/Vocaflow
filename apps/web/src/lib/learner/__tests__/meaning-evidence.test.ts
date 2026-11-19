// apps/web/src/lib/learner/__tests__/meaning-evidence.test.ts
import { describe, expect, it } from 'vitest'
import { MEANING_EVIDENCE_TYPES, isMeaningEvidenceType, meaningEvidenceSentences } from '../meaning-evidence'

const PASSAGE = 'Lincoln spent many summers at a quiet cottage. He did much of his thinking there.\nThe house was cooler than the city. He rode a horse to work each day.'

describe('meaning-evidence — 중심 의미 유형에만', () => {
  it('제목 · 주제 · 요지 · 요약 · 목적 · 주장 · 장문 제목만 대상', () => {
    for (const t of MEANING_EVIDENCE_TYPES) expect(isMeaningEvidenceType(t)).toBe(true)
    for (const t of ['blank', 'order', 'insert', 'content_match', 'implication', 'mood', 'long_vocab', 'long_reference', 'underline_vocab', null]) expect(isMeaningEvidenceType(t)).toBe(false)
  })

  it('지문을 문장으로 나눈다(단락 경계 포함)', () => {
    expect(meaningEvidenceSentences('title', PASSAGE)).toEqual([
      'Lincoln spent many summers at a quiet cottage.',
      'He did much of his thinking there.',
      'The house was cooler than the city.',
      'He rode a horse to work each day.',
    ])
  })

  it('대상 유형이 아니거나 지문이 없거나 한 문장뿐이면 null(그리지 않는다)', () => {
    expect(meaningEvidenceSentences('blank', PASSAGE)).toBeNull()
    expect(meaningEvidenceSentences('topic', undefined)).toBeNull()
    expect(meaningEvidenceSentences('topic', 'Only one sentence here.')).toBeNull()
  })
})

describe('약어에서 잘린 조각 잇기', () => {
  it('Washington, D.C. · Mr. 같은 약어로 문장 후보가 조각나지 않는다', () => {
    const p = 'President Lincoln lived in Washington, D.C., during the war. Mr. Lincoln liked the cottage. It was quiet.'
    expect(meaningEvidenceSentences('topic', p)).toEqual([
      'President Lincoln lived in Washington, D.C., during the war.',
      'Mr. Lincoln liked the cottage.',
      'It was quiet.',
    ])
  })
  it('보통 문장 끝(대문자로 시작하는 다음 문장)은 잇지 않는다', () => {
    expect(meaningEvidenceSentences('title', 'He rode a horse. The house was cool.')).toEqual(['He rode a horse.', 'The house was cool.'])
  })
})

describe('원문 글자 보존(Codex 반례)', () => {
  it('소문자로 시작하는 다음 조각을 잇지 않고 글자를 바꾸지 않는다', () => {
    const p = 'A quiet place. small birds, nearby.'
    const out = meaningEvidenceSentences('title', p)!
    expect(out.join(' ')).toBe(p)
    expect(out.some((s) => s.includes('birds'))).toBe(true)
  })
})

describe('보호 문자 · St. (리뷰 P3)', () => {
  it('보호 문자는 한 글자(빈 문자열이 되면 split 이 글자마다 쪼갠다)', async () => {
    const { DOT } = await import('../meaning-evidence')
    expect(DOT.length).toBe(1)
    expect(DOT.charCodeAt(0)).toBe(0xe000)
  })
  it('문장 끝 「St.」 에서는 두 문장으로 나뉜다', () => {
    expect(meaningEvidenceSentences('title', 'The bakery is on Main St. The owner bakes by hand.')).toEqual(['The bakery is on Main St.', 'The owner bakes by hand.'])
  })
})
