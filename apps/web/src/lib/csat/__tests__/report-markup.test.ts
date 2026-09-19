// apps/web/src/lib/csat/__tests__/report-markup.test.ts
//
// 이 파서가 지키는 것 둘:
//   ① **원문 글자를 잃지 않는다** — 산문을 쪼개다 한 조각을 떨어뜨리면 그 문장은 영영 안 보이고,
//      화면은 멀쩡히 돈다. 가장 조용한 실패다.
//   ② **없는 문항으로 링크를 만들지 않는다** — 막다른 화면이 된다(D4).

import { describe, expect, it } from 'vitest'

import { citedItems, parseReportText, type Block } from '../report-markup'

const KNOWN = new Set(['2014B#32', 'M1809#35', '2018#35'])

/** 블록에서 글자만 다시 이어 붙인다 — 잃은 것이 있는지 보는 자. */
const flatten = (blocks: Block[]): string => blocks.map((b) => b.segments.map((s) => s.text).join('')).join('\n\n')

describe('parseReportText — 문단', () => {
  it('빈 줄 두 개로 문단을 나눈다', () => {
    expect(parseReportText('첫 문단.\n\n둘째 문단.')).toHaveLength(2)
  })

  it('한 줄 바꿈은 문단이 아니다', () => {
    expect(parseReportText('한 줄.\n이어지는 줄.')).toHaveLength(1)
  })

  it('빈 문단을 버린다', () => {
    expect(parseReportText('가.\n\n\n\n나.')).toHaveLength(2)
  })

  it('빈 입력에 빈 배열', () => {
    expect(parseReportText('')).toEqual([])
    expect(parseReportText(null)).toEqual([])
    expect(parseReportText(undefined)).toEqual([])
  })
})

describe('parseReportText — 굵게', () => {
  it('별표를 벗기고 strong 으로 만든다', () => {
    const b = parseReportText('앞 **굵은 말** 뒤')
    expect(b[0].segments).toEqual([
      { kind: 'text', text: '앞 ' },
      { kind: 'strong', text: '굵은 말' },
      { kind: 'text', text: ' 뒤' },
    ])
  })

  it('문단이 굵게로 시작해도 된다', () => {
    const b = parseReportText('**머리말.** 그리고 본문.')
    expect(b[0].segments[0]).toEqual({ kind: 'strong', text: '머리말.' })
  })

  it('짝이 안 맞는 별표는 그대로 둔다 — 지어내지 않는다', () => {
    const b = parseReportText('한쪽만 **있는 경우')
    expect(flatten(b)).toBe('한쪽만 **있는 경우')
  })
})

describe('parseReportText — 문항 링크', () => {
  it('아는 문항만 item 조각이 된다', () => {
    const b = parseReportText('2014B#32 와 9999#99 를 본다', KNOWN)
    const kinds = b[0].segments.map((s) => s.kind)
    expect(kinds).toContain('item')
    expect(b[0].segments.find((s) => s.kind === 'item')).toEqual({
      kind: 'item',
      text: '2014B#32',
      itemId: '2014B#32',
    })
    // 모르는 참조는 평문으로 남는다 — 없는 문항으로 가는 링크는 막다른 화면이다.
    expect(flatten(b)).toContain('9999#99')
    expect(b[0].segments.filter((s) => s.kind === 'item')).toHaveLength(1)
  })

  it('known 이 비어 있으면 링크가 하나도 안 생긴다', () => {
    const b = parseReportText('2014B#32 를 본다')
    expect(b[0].segments.every((s) => s.kind !== 'item')).toBe(true)
  })

  it('굵게 안의 문항도 링크가 된다', () => {
    const b = parseReportText('**2018#35 가 그 예다**', KNOWN)
    const item = b[0].segments.find((s) => s.kind === 'item')
    expect(item?.itemId).toBe('2018#35')
    // 굵게 안의 나머지 글자는 strong 으로 남는다
    expect(b[0].segments.some((s) => s.kind === 'strong')).toBe(true)
  })

  it('M 회차 형식도 잡는다', () => {
    const b = parseReportText('M1809#35 참조', KNOWN)
    expect(b[0].segments.find((s) => s.kind === 'item')?.itemId).toBe('M1809#35')
  })
})

describe('parseReportText — 글자를 잃지 않는가', () => {
  it('별표만 벗기고 나머지는 그대로다', () => {
    const src = '**옛 회차는 빈칸을 끝에 놓는다.** 9문항 중 8문항이 그랬다(2014B#32 7/7).\n\n예외는 하나뿐이다.'
    const got = flatten(parseReportText(src, KNOWN))
    expect(got).toBe(src.replace(/\*\*/g, ''))
  })

  it('실제 리포트 모양(굵게 + 인용 + 여러 문단)에서도 잃지 않는다', () => {
    const src =
      '**규칙 하나.** 근거는 뒤에 있다 — 2014B#32 · M1809#35 가 그렇다.\n\n' +
      '두 번째 문단. **또 굵게** 그리고 2018#35 도 같다.\n\n' +
      '세 번째.'
    const blocks = parseReportText(src, KNOWN)
    expect(blocks).toHaveLength(3)
    expect(flatten(blocks)).toBe(src.replace(/\*\*/g, ''))
    expect(blocks.flatMap((b) => b.segments).filter((s) => s.kind === 'item')).toHaveLength(3)
  })

  it('이어진 평문 조각을 합친다 — 잘게 쪼개면 화면에서 자간이 어긋난다', () => {
    const b = parseReportText('가나다 라마바', KNOWN)
    expect(b[0].segments).toHaveLength(1)
  })
})

describe('citedItems', () => {
  it('아는 문항만 중복 없이 모은다', () => {
    expect(citedItems('2014B#32 · 2014B#32 · M1809#35 · 9999#99', KNOWN)).toEqual(['2014B#32', 'M1809#35'])
  })

  it('없으면 빈 배열', () => {
    expect(citedItems(null)).toEqual([])
    expect(citedItems('인용 없음', KNOWN)).toEqual([])
  })
})
