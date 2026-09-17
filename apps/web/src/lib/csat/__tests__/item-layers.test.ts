// apps/web/src/lib/csat/__tests__/item-layers.test.ts
//
// **문항 해설 4층 — 잘린 것을 온전한 문장으로 속이지 않는다.**
//
// 인용 상한은 저작권 경계에 걸린 값이라 조용히 무력화되면 안 된다. 그리고 상한이 걸렸을 때
// 그 사실이 화면에 보여야 한다 — 말줄임 없이 자르면 학습자는 조각을 문장으로 읽는다.

import { describe, expect, it } from 'vitest'

import { capQuoteWords, QUOTE_WORD_CAP } from '../learner'

describe('근거 인용 상한', () => {
  it('상한은 40낱말 — 수능 지문(약 140낱말)의 3할', () => {
    expect(QUOTE_WORD_CAP).toBe(40)
  })

  it('짧은 인용은 그대로 둔다 — 중앙값 17낱말이 대부분이다', () => {
    const q = 'can be imperceptible; it proceeds rapidly, only occasionally producing events'
    expect(capQuoteWords(q)).toBe(q)
  })

  it('딱 상한이면 자르지 않는다', () => {
    const q = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')
    expect(capQuoteWords(q)).toBe(q)
  })

  it('넘으면 자르고 **말줄임을 붙인다** — 자른 사실을 숨기지 않는다', () => {
    const q = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ')
    const out = capQuoteWords(q)!
    expect(out.endsWith(' …')).toBe(true)
    // 말줄임을 뺀 낱말 수가 정확히 상한이다.
    expect(out.replace(/ …$/, '').split(/\s+/)).toHaveLength(40)
  })

  it('잘린 결과는 원문의 앞부분이다 — 낱말을 바꾸지 않는다', () => {
    const q = Array.from({ length: 55 }, (_, i) => `w${i}`).join(' ')
    expect(q.startsWith(capQuoteWords(q)!.replace(/ …$/, ''))).toBe(true)
  })

  it('여러 칸 공백·줄바꿈도 낱말 하나로 센다', () => {
    const q = `a\n\nb   c\td`
    expect(capQuoteWords(q, 2)).toBe('a b …')
  })

  it('비었거나 공백뿐이면 null — 빈 인용 칸을 그리지 않는다', () => {
    expect(capQuoteWords(null)).toBeNull()
    expect(capQuoteWords('')).toBeNull()
    expect(capQuoteWords('   \n ')).toBeNull()
  })

  it('상한을 넘기면 결과가 원문보다 짧다 — 자기무력화 가드', () => {
    // 누군가 상한을 Infinity 로 바꾸거나 자르기를 지우면 여기서 깨진다.
    const q = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ')
    expect(capQuoteWords(q)!.length).toBeLessThan(q.length)
  })
})
