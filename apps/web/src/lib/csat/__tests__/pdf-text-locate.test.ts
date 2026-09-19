// apps/web/src/lib/csat/__tests__/pdf-text-locate.test.ts
//
// PDF 텍스트 조각 → 강조 상자. 이 계산이 틀리면 **엉뚱한 자리가 칠해지고 화면은 멀쩡히 돈다.**
// 그래서 여기서 보는 것은 «찾았는가» 가 아니라 «찾은 자리가 맞는가» 다.

import { describe, expect, it } from 'vitest'

import { joinTextItems, locateQuote, locateQuotes, pageHasQuote, type PdfTextItem } from '../pdf-text-locate'

/** 한 줄에 놓인 조각 하나. x 부터 width 만큼, 글자 수로 폭을 나눠 쓴다. */
const item = (str: string, x: number, y: number, width: number, hasEOL = false): PdfTextItem => ({
  str,
  transform: [10, 0, 0, 10, x, y],
  width,
  height: 10,
  hasEOL,
})

describe('joinTextItems — 조각을 잇는다', () => {
  it('공백 없이 붙은 조각 사이에 한 칸을 끼운다', () => {
    expect(joinTextItems([item('can be', 0, 100, 60), item('imperceptible', 70, 100, 130)]).text).toBe(
      'can be imperceptible',
    )
  })

  it('이미 공백이 있으면 더 끼우지 않는다', () => {
    expect(joinTextItems([item('can be ', 0, 100, 70), item('slow', 70, 100, 40)]).text).toBe('can be slow')
  })

  it('줄바꿈은 한 칸이 된다', () => {
    expect(joinTextItems([item('first line', 0, 100, 90, true), item('second', 0, 88, 60)]).text).toBe(
      'first line second',
    )
  })

  it('조각 구간이 이어지고 겹치지 않는다', () => {
    const j = joinTextItems([item('abc', 0, 0, 30), item('def', 40, 0, 30)])
    expect(j.spans[0]).toEqual({ start: 0, end: 3 })
    expect(j.spans[1].start).toBeGreaterThanOrEqual(j.spans[0].end)
    expect(j.text.slice(j.spans[1].start, j.spans[1].end)).toBe('def')
  })

  it('owner 가 글자마다 있다', () => {
    const j = joinTextItems([item('ab', 0, 0, 20), item('cd', 30, 0, 20)])
    expect(j.owner).toHaveLength(j.text.length)
    expect(j.owner[0]).toBe(0)
    expect(j.owner[j.text.length - 1]).toBe(1)
  })

  it('빈 입력에 빈 결과', () => {
    expect(joinTextItems([]).text).toBe('')
  })
})

describe('locateQuote — 상자가 맞는 자리에 생기는가', () => {
  it('한 조각 안의 일부를 덮는다', () => {
    // 'abcdefghij' 가 x=100 에서 폭 100 → 글자당 10
    const boxes = locateQuote([item('abcdefghij', 100, 200, 100)], 'cde')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].x).toBeCloseTo(120) // 2글자 뒤
    expect(boxes[0].w).toBeCloseTo(30) // 3글자
    expect(boxes[0].y).toBe(200)
  })

  it('조각 두 개에 걸치면 상자도 둘이다 — 합치면 줄 사이 빈 곳까지 칠해진다', () => {
    const boxes = locateQuote(
      [item('can be', 0, 100, 60, true), item('imperceptible', 0, 88, 130)],
      'can be imperceptible',
    )
    expect(boxes).toHaveLength(2)
    expect(boxes[0].y).toBe(100)
    expect(boxes[1].y).toBe(88)
  })

  it('굽은따옴표가 달라도 찾는다 — quote-match 를 그대로 쓴다', () => {
    const boxes = locateQuote([item('it “proceeds” slowly', 0, 50, 200)], 'it "proceeds" slowly')
    expect(boxes.length).toBeGreaterThan(0)
  })

  it('못 찾으면 빈 배열이다 — «첫 줄» 이 아니다', () => {
    // 틀린 자리를 자신 있게 칠하는 것이 아무것도 안 칠하는 것보다 나쁘다.
    expect(locateQuote([item('hello world', 0, 0, 100)], 'not here at all')).toEqual([])
  })

  it('빈 입력에 빈 배열', () => {
    expect(locateQuote([], 'x')).toEqual([])
    expect(locateQuote([item('a', 0, 0, 10)], '')).toEqual([])
  })

  it('상자가 조각 밖으로 나가지 않는다', () => {
    const it0 = item('abcdefghij', 100, 200, 100)
    for (const b of locateQuote([it0], 'abcdefghij')) {
      expect(b.x).toBeGreaterThanOrEqual(100)
      expect(b.x + b.w).toBeLessThanOrEqual(100 + 100 + 0.001)
    }
  })

  it('높이는 조각의 높이를 쓴다', () => {
    expect(locateQuote([item('abc', 0, 0, 30)], 'abc')[0].h).toBe(10)
  })
})

describe('locateQuotes — 순서를 지킨다', () => {
  it('못 찾은 것을 빼지 않고 빈 배열로 자리를 지킨다', () => {
    const items = [item('alpha beta gamma', 0, 0, 160)]
    const got = locateQuotes(items, ['alpha', '없는 말', 'gamma'])
    expect(got).toHaveLength(3)
    expect(got[0].length).toBeGreaterThan(0)
    expect(got[1]).toEqual([])
    expect(got[2].length).toBeGreaterThan(0)
  })

  it('조각이 없으면 전부 빈 배열', () => {
    expect(locateQuotes([], ['a', 'b'])).toEqual([[], []])
  })
})

describe('pageHasQuote — 페이지 고르기', () => {
  it('있으면 참', () => {
    expect(pageHasQuote([item('can be imperceptible', 0, 0, 200)], 'be imperceptible')).toBe(true)
  })

  it('없으면 거짓', () => {
    expect(pageHasQuote([item('other text', 0, 0, 100)], 'be imperceptible')).toBe(false)
  })

  it('줄바꿈으로 쪼개져 있어도 찾는다 — PDF 는 한 문장을 줄마다 자른다', () => {
    const items = [item('environmental change can', 0, 100, 200, true), item('be imperceptible', 0, 88, 150)]
    expect(pageHasQuote(items, 'change can be imperceptible')).toBe(true)
  })

  it('빈 입력에 거짓', () => {
    expect(pageHasQuote([], 'x')).toBe(false)
    expect(pageHasQuote([item('a', 0, 0, 10)], '')).toBe(false)
  })
})
