// packages/library-pipeline/src/textbook/csat-format.test.ts
//
// 수능 인쇄 형식의 계약. 형식이 실전과 다르면 연습 효과가 반감되므로,
// **답지 개수·자리 개수·원순서 제외**를 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  CSAT_INSERT_BODY_SENTENCES,
  hasCitationResidue,
  ORDER_PERMS,
  splitIntoThree,
  toCsatInsert,
  toCsatOrder,
} from './csat-format'

/** 원문 n문장을 만들고, DCP 저장 형식(presented + source_order)으로 셔플해 돌려준다. */
const shuffled = (n: number, perm: number[]) => {
  const original = Array.from({ length: n }, (_, i) => `S${i}.`)
  return { presented: perm.map((i) => original[i]!), sourceOrder: perm, original }
}

describe('toCsatOrder', () => {
  it('도입문을 떼고 나머지를 (A)(B)(C) 세 덩어리로 만든다', () => {
    const { presented, sourceOrder } = shuffled(4, [2, 0, 3, 1])
    const it4 = toCsatOrder(presented, sourceOrder)!
    expect(it4.intro).toBe('S0.')
    expect(it4.blocks.map((b) => b.label)).toEqual(['A', 'B', 'C'])
    expect(it4.blocks.flatMap((b) => b.sentences).sort()).toEqual(['S1.', 'S2.', 'S3.'])
  })

  it('답지는 5개이고 **원순서 (A)-(B)-(C) 는 없다**', () => {
    // 원순서가 답지에 있으면 그게 정답일 때 문제가 성립하지 않는다. 수능도 뺀다.
    const { presented, sourceOrder } = shuffled(5, [1, 3, 0, 4, 2])
    const item = toCsatOrder(presented, sourceOrder)!
    expect(item.choices).toHaveLength(5)
    expect(item.choices.some((c) => c.join('') === 'ABC')).toBe(false)
    expect(ORDER_PERMS).toHaveLength(5)
  })

  it('정답 번호가 가리키는 답지대로 배열하면 원문이 된다', () => {
    for (const [n, perm] of [
      [4, [2, 0, 3, 1]],
      [5, [1, 3, 0, 4, 2]],
      [6, [3, 1, 5, 0, 4, 2]],
    ] as const) {
      const { presented, sourceOrder, original } = shuffled(n, [...perm])
      const item = toCsatOrder(presented, sourceOrder)!
      const answerLabels = item.choices[item.answer - 1]!
      const rebuilt = [
        item.intro,
        ...answerLabels.flatMap((l) => item.blocks.find((b) => b.label === l)!.sentences),
      ]
      expect(rebuilt, `n=${n}`).toEqual(original)
    }
  })

  it('같은 지문은 늘 같은 문항이 된다 — 멱등', () => {
    const { presented, sourceOrder } = shuffled(5, [1, 3, 0, 4, 2])
    const a = toCsatOrder(presented, sourceOrder)!
    const b = toCsatOrder(presented, sourceOrder)!
    expect(a.answer).toBe(b.answer)
    expect(a.blocks).toEqual(b.blocks)
  })

  it('4문장 미만이면 만들지 않는다 — 도입 + 3덩어리가 안 나온다', () => {
    const { presented, sourceOrder } = shuffled(3, [1, 2, 0])
    expect(toCsatOrder(presented, sourceOrder)).toBeNull()
  })
})

describe('toCsatInsert', () => {
  const body = ['A.', 'B.', 'C.', 'D.', 'E.']

  it('지문 5문장 · 자리 5곳 — 수능 ①~⑤ 와 같다', () => {
    const item = toCsatInsert(body, 'X.', 3)!
    expect(item.body).toHaveLength(CSAT_INSERT_BODY_SENTENCES)
    expect(item.slots).toEqual([1, 2, 3, 4, 5])
    expect(item.answer).toBe(3)
  })

  it('**정답이 ①~⑤ 어디든 될 수 있다** — 첫 자리가 빠지지 않는다', () => {
    // 저장 형식에서는 removeIdx 가 1..n-1 이라 "첫 자리는 절대 정답이 아니다" 는
    //   편향이 있었다. n=6 일 때 1~5 가 ①~⑤ 에 그대로 대응해 편향이 사라진다.
    for (const p of [1, 2, 3, 4, 5]) {
      expect(toCsatInsert(body, 'X.', p)!.answer).toBe(p)
    }
  })

  it('자리를 5곳 못 만들면 거부한다 — ①~③ 을 연습시키지 않는다', () => {
    expect(toCsatInsert(['A.', 'B.', 'C.'], 'X.', 2)).toBeNull()
    expect(toCsatInsert(['A.', 'B.', 'C.', 'D.'], 'X.', 2)).toBeNull()
    // 상한 밖(10문장)도 거부 — 지문이 너무 길면 수능 지문이 아니다.
    expect(toCsatInsert(Array.from({ length: 10 }, (_, i) => `S${i}.`), 'X.', 2)).toBeNull()
  })

  it('지문이 6~9문장이어도 자리는 5곳이다 — 실제 수능 지문이 그렇다', () => {
    for (const n of [6, 7, 8, 9]) {
      const long = Array.from({ length: n }, (_, i) => `S${i}.`)
      const item = toCsatInsert(long, 'X.', 3)
      expect(item, `n=${n}`).not.toBeNull()
      expect(item!.slots, `n=${n}`).toHaveLength(5)
      expect(item!.body, `n=${n}`).toHaveLength(n)
    }
  })

  it('정답 자리는 언제나 답지 안에 있다', () => {
    for (const n of [5, 6, 7, 8, 9]) {
      const long = Array.from({ length: n }, (_, i) => `S${i}.`)
      for (let pos = 1; pos <= n; pos++) {
        const item = toCsatInsert(long, 'X.', pos)!
        expect(item.slots, `n=${n} pos=${pos}`).toContain(pos)
        expect(item.slots[item.answer - 1], `n=${n} pos=${pos}`).toBe(pos)
      }
    }
  })

  it('자리를 지문에 고르게 퍼뜨린다 — 정답만 외따로면 위치로 찍는다', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `S${i}.`)
    const slots = toCsatInsert(nine, 'X.', 5)!.slots
    expect(slots[0]).toBe(1)
    expect(slots[slots.length - 1]).toBe(9)
  })

  it('범위 밖 정답은 거부한다', () => {
    expect(toCsatInsert(body, 'X.', 0)).toBeNull()
    expect(toCsatInsert(body, 'X.', 6)).toBeNull()
  })
})

describe('hasCitationResidue', () => {
  it('논문 인용 잔해를 잡는다 — 실물 사례', () => {
    // 실측: 문항 758개 중 64개에 있었고 전부 PLOS 였다.
    expect(hasCitationResidue('[] trained the model using a sample set and 71 features')).toBe(true)
    expect(hasCitationResidue('as shown by earlier work [12].')).toBe(true)
    expect(hasCitationResidue('see [3, 4] for details')).toBe(true)
  })

  it('평범한 문장은 통과시킨다', () => {
    for (const s of [
      'Bees pollinate most of the crops we eat.',
      'The bracket [ was never closed.',
      'He said "wait" and left.',
    ]) {
      expect(hasCitationResidue(s), s).toBe(false)
    }
  })

  it('잔해가 있으면 변환 자체를 막는다 — 교재에 인쇄될 수 없다', () => {
    const body = ['A [] b.', 'B.', 'C.', 'D.', 'E.']
    expect(toCsatInsert(body, 'X.', 3)).toBeNull()
    const presented = ['P [12] q.', 'Q.', 'R.', 'S.']
    expect(toCsatOrder(presented, [0, 1, 2, 3])).toBeNull()
  })
})

describe('splitIntoThree', () => {
  it('앞쪽 덩어리가 더 길다', () => {
    expect(splitIntoThree(3)).toEqual([1, 1, 1])
    expect(splitIntoThree(4)).toEqual([2, 1, 1])
    expect(splitIntoThree(5)).toEqual([2, 2, 1])
    expect(splitIntoThree(6)).toEqual([2, 2, 2])
  })

  it('3문장 미만은 나눌 수 없다', () => {
    expect(splitIntoThree(2)).toBeNull()
  })

  it('합이 보존된다', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      expect(splitIntoThree(n)!.reduce((a, b) => a + b, 0), `n=${n}`).toBe(n)
    }
  })
})
