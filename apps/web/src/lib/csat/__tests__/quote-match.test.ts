// apps/web/src/lib/csat/__tests__/quote-match.test.ts
//
// 이 검사가 지키는 것은 한 가지다 — **찾은 자리가 원본의 그 자리인가.**
// 정규화는 길이를 바꾸므로, 맞는 문자열을 찾고도 엉뚱한 구간을 돌려줄 수 있다.
// 그 실패는 화면에서 "근거 문장이 한 칸 밀려 칠해짐" 으로 나타나 조용하다.

import { describe, expect, it } from 'vitest'

import { findQuote, findQuotes, normalizeForMatch } from '../quote-match'

describe('normalizeForMatch', () => {
  it('굽은따옴표와 대시를 곧은 것으로 접는다', () => {
    expect(normalizeForMatch('can be “imperceptible”—yes').text).toBe('can be "imperceptible"-yes')
  })

  it('연속 공백을 하나로 접고 앞뒤 공백을 버린다', () => {
    expect(normalizeForMatch('  a \n\t b  ').text).toBe('a b')
  })

  it('지도의 길이는 접힌 문자열보다 하나 길다 (끝 경계)', () => {
    const n = normalizeForMatch('a  b')
    expect(n.map).toHaveLength(n.text.length + 1)
  })

  it('폭 없는 문자를 버린다 — PDF 추출물에 섞인다', () => {
    expect(normalizeForMatch('so​ft­hyphen').text).toBe('softhyphen')
  })
})

describe('findQuote — 원본 좌표로 되돌아오는가', () => {
  it('그대로 있으면 exact 로 찾는다', () => {
    const h = 'The cat sat on the mat.'
    const hit = findQuote(h, 'sat on')
    expect(hit).toEqual({ start: 8, end: 14, exact: true })
    expect(h.slice(hit!.start, hit!.end)).toBe('sat on')
  })

  it('굽은따옴표만 다를 때도 찾고, 구간은 원본을 가리킨다', () => {
    const h = 'it “proceeds” slowly'
    const hit = findQuote(h, 'it "proceeds" slowly')
    expect(hit?.exact).toBe(false)
    expect(h.slice(hit!.start, hit!.end)).toBe(h)
  })

  it('원문에 줄바꿈이 끼어 있어도 찾는다 (PDF 텍스트 레이어)', () => {
    // 이것이 이 모듈의 존재 이유다 — PDF 는 한 문장을 줄마다 잘라 내놓는다.
    const h = 'environmental change\ncan be imperceptible; it\n  proceeds slowly'
    const hit = findQuote(h, 'can be imperceptible; it proceeds slowly')
    expect(hit).not.toBeNull()
    // 원본 구간을 다시 접으면 인용문과 같아야 한다 — 한 칸도 밀리지 않았다는 뜻
    expect(normalizeForMatch(h.slice(hit!.start, hit!.end)).text).toBe('can be imperceptible; it proceeds slowly')
  })

  it('없으면 null 이다 — 0 이 아니다', () => {
    // 0 을 돌려주면 부르는 쪽이 첫 문장을 근거라고 칠한다. 틀린 자리를 자신 있게
    // 칠하는 것이 아무것도 안 칠하는 것보다 나쁘다.
    expect(findQuote('The cat sat.', 'the dog ran')).toBeNull()
  })

  it('빈 입력에 0 을 돌려주지 않는다', () => {
    expect(findQuote('', 'x')).toBeNull()
    expect(findQuote('x', '')).toBeNull()
  })

  it('from 을 주면 그 뒤의 것을 찾는다 — 같은 문장이 두 번 나오는 지문', () => {
    const h = 'A rule. B rule. A rule.'
    const first = findQuote(h, 'A rule.')!
    const second = findQuote(h, 'A rule.', first.end)!
    expect(first.start).toBe(0)
    expect(second.start).toBe(16)
  })

  it('from 은 접힌 경로에서도 지켜진다', () => {
    const h = 'A  “rule”. B. A  “rule”.'
    const first = findQuote(h, 'A "rule".')!
    const second = findQuote(h, 'A "rule".', first.end)
    expect(second).not.toBeNull()
    expect(second!.start).toBeGreaterThan(first.start)
  })
})

describe('findQuotes', () => {
  it('못 찾은 것을 빼지 않고 null 로 자리를 지킨다', () => {
    // 배열에서 빼 버리면 n번째 인용과 n번째 결과가 어긋난다 — 오답 ②의 근거가
    // ③ 자리에 칠해지는 종류의 사고다.
    const got = findQuotes('The cat sat.', ['cat', 'dog', 'sat'])
    expect(got).toHaveLength(3)
    expect(got[1]).toBeNull()
    expect(got[0]?.start).toBe(4)
    expect(got[2]?.start).toBe(8)
  })
})
