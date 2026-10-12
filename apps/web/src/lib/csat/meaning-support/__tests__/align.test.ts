// apps/web/src/lib/csat/meaning-support/__tests__/align.test.ts
//
// 원문 대조 — 빌드(.mjs)와 화면(align.ts)의 글자 정규화 · 지문이 같은 값 · 대조 판정(같은 문장 수 · 같은 길이 · 다른 글자 구별) · 분할 검사
import { describe, expect, it } from 'vitest'

import { buildAlignment, lettersOnly as mjsLetters, textHash as mjsHash } from '../../../../../../../scripts/csat/lib-meaning-support.mjs'
import { alignPassage, lettersOnly, splitMatches, textHash, type MsAlignment } from '../align'

const SAMPLES = ['The only way, in short—is “to try”.', 'ﬁne Ａｂｃ ① (A) 2026', '', 'Café naïve — it’s 3:00', 'x'.repeat(500)]

describe('정규화 · 지문 동치(빌드 = 화면)', () => {
  it('표본 문자열', () => {
    for (const s of SAMPLES) {
      expect(lettersOnly(s)).toBe(mjsLetters(s))
      expect(textHash(lettersOnly(s))).toBe(mjsHash(mjsLetters(s)))
    }
  })
})

// 합성 원문(실제 기출 아님) — 대조 판정만 시험한다
const input = {
  sentences: [
    { n: 1, text: 'Rules can protect freedom.' },
    { n: 2, text: 'If a law only forbids what reason forbids, it does not restrict us.' },
    { n: 3, text: 'So rational laws protect freedom.' },
  ],
}
const support = {
  anchors: [
    { id: 'a1', sentence: 2, quote: 'only forbids what reason forbids', mode: 'original' },
    { id: 'a2', sentence: 3, sourceRange: { start: 0, end: 2, spanHash: 'x' }, mode: 'original' },
  ],
}
const alignment = buildAlignment(support, input) as MsAlignment
const passage = input.sentences.map((s) => s.text).join('\n')

describe('alignPassage', () => {
  it('같은 원문 → ok · 구절의 실제 위치', () => {
    const r = alignPassage(alignment, 'ready', passage)
    expect(r.state).toBe('ok')
    if (r.state !== 'ok') return
    expect(passage.slice(r.spans.a1.start, r.spans.a1.end)).toBe('only forbids what reason forbids')
    expect(passage.slice(r.spans.a2.start, r.spans.a2.end)).toBe('So')
    expect(passage.slice(r.sentences[3].start, r.sentences[3].end)).toBe('So rational laws protect freedom')
  })
  it('추출 차이(줄바꿈 · 따옴표 · 문단 표지)는 흡수', () => {
    const noisy = `(A) ${input.sentences[0].text}  ${input.sentences[1].text.replace(/ /g, '\n')} “${input.sentences[2].text}”`
    expect(alignPassage(alignment, 'ready', noisy).state).toBe('ok')
  })
  it('같은 문장 수 · 같은 길이 · 다른 글자 → mismatch(그 문장 번호)', () => {
    const swapped = passage.replace('forbids what', 'permits what')
    expect(swapped.length).toBe(passage.length)
    expect(alignPassage(alignment, 'ready', swapped)).toEqual({ state: 'mismatch', sentence: 2, why: 'sentence' })
  })
  it('문제지 상태', () => {
    expect(alignPassage(alignment, 'loading', null).state).toBe('pending')
    expect(alignPassage(alignment, 'missing', null)).toEqual({ state: 'no_source', why: 'missing' })
    expect(alignPassage(alignment, 'unreadable', null)).toEqual({ state: 'no_source', why: 'unreadable' })
    expect(alignPassage(null, 'ready', passage).state).toBe('mismatch')
  })
})

describe('splitMatches — 지도 골격과 작성 원문의 분할', () => {
  const chars = input.sentences.map((s) => s.text.length)
  it('같으면 true · 문장 수 · 길이가 다르면 false', () => {
    expect(splitMatches(alignment, chars)).toBe(true)
    expect(splitMatches(alignment, chars.slice(0, 2))).toBe(false)
    expect(splitMatches(alignment, [chars[0], chars[1] + 1, chars[2]])).toBe(false)
    expect(splitMatches(alignment, null)).toBe(false)
  })
})
