// apps/web/src/app/(main)/text/[id]/__tests__/chapter-marker-paragraphs.test.ts
//
// 장 표식 줄을 **표시 단계에서만** 분리한다(2026-10-19 · docs/content-defects/2026-10-19-chapter-marker-in-body.md).
// 지키는 것: ① 문단 수 · 번호가 그대로다(이어읽기 current_paragraph_idx) ② 표식 문단은 문장이 비고 출처를 들고 간다
// ③ 정상 첫 줄(RS 없는 「CHAPTER …」 제목 줄 · 평범한 문장)은 그대로 문장이 된다.

import { describe, expect, it } from 'vitest'

import { buildParagraphsFromContent } from '../text-content-helpers'

const RS = String.fromCharCode(0x1e)
const HREF = 'https://standardebooks.org/ebooks/charles-dickens/a-christmas-carol/text/chapter-1'

/** 문단 시작 위치(paragraph_offsets) — 빈 줄 두 개로 나눈 본문에서 계산 */
function offsets(content: string): number[] {
  const out = [0]
  let i = content.indexOf('\n\n')
  while (i >= 0) {
    out.push(i + 2)
    i = content.indexOf('\n\n', i + 2)
  }
  return out
}

describe('buildParagraphsFromContent — 장 표식', () => {
  const marked = `CHAPTER 1. Marley's Ghost${RS}${HREF}\n\nMarley was dead, to begin with. There is no doubt whatever about that.\n\nScrooge signed it.`

  it('문단 수와 번호는 그대로다', () => {
    const ps = buildParagraphsFromContent(marked, offsets(marked))
    expect(ps.map((p) => p.id)).toEqual([0, 1, 2])
  })

  it('표식 문단은 문장이 없고 출처를 들고 간다', () => {
    const [first] = buildParagraphsFromContent(marked, offsets(marked))
    expect(first!.sentences).toEqual([])
    expect(first!.chapterMarker).toEqual({ number: '1', title: "Marley's Ghost", group: undefined, sourceHref: HREF })
  })

  it('문장 번호는 첫 실제 문장부터 0 — URL 은 어느 문장에도 없다', () => {
    const ps = buildParagraphsFromContent(marked, offsets(marked))
    const sentences = ps.flatMap((p) => p.sentences)
    expect(sentences[0]!.id).toBe(0)
    expect(sentences.map((s) => s.parts.map((x) => x.text).join('')).join(' ')).not.toContain('standardebooks')
    expect(sentences).toHaveLength(3)
  })

  it('offsets 가 없어도(빈 줄 분리) 같은 결과', () => {
    const ps = buildParagraphsFromContent(marked, [])
    expect(ps[0]!.chapterMarker?.sourceHref).toBe(HREF)
    expect(ps[0]!.sentences).toEqual([])
  })
})

describe('buildParagraphsFromContent — 정상 첫 줄은 숨기지 않는다', () => {
  it('RS 없는 「CHAPTER …」 제목 줄은 문장이다', () => {
    const plain = 'CHAPTER 1. Marley’s Ghost\n\nMarley was dead, to begin with.'
    const [first] = buildParagraphsFromContent(plain, offsets(plain))
    expect(first!.chapterMarker).toBeUndefined()
    expect(first!.sentences.length).toBeGreaterThan(0)
  })

  it('표식이 첫 문단이 아니면 건드리지 않는다', () => {
    const later = `Marley was dead.\n\nCHAPTER 2. X${RS}${HREF}`
    const ps = buildParagraphsFromContent(later, offsets(later))
    expect(ps.every((p) => p.chapterMarker === undefined)).toBe(true)
    expect(ps[1]!.sentences.length).toBeGreaterThan(0)
  })

  it('평범한 본문', () => {
    const text = 'It was the best of times. It was the worst of times.'
    const ps = buildParagraphsFromContent(text, [0])
    expect(ps[0]!.chapterMarker).toBeUndefined()
    expect(ps[0]!.sentences).toHaveLength(2)
  })
})
