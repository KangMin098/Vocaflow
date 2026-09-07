// packages/library-pipeline/src/textbook/explain-seam.test.ts

import { describe, expect, it } from 'vitest'
import { toCsatInsert, toCsatOrder } from './csat-format'
import { EXPLANATION_CHARS } from './explain-items'
import { explainInsertSeam, explainOrderSeam, explainShortInsertSeam } from './explain-seam'

// 원문 8문장. `toCsatOrder` 는 도입문 1 + (A)(B)(C) 로 가른다.
const SOURCE = [
  'Milestones once told travellers how far they still had to go.',
  'The people who ruled the roads wanted one fixed way to measure a route.',
  'A letter or a load could then be charged by the same rule everywhere.',
  'As a result, the stones did more than count.',
  'They turned a rough path into a road with a shape.',
  'That road could be named, mended, and compared with other roads.',
  'Later, signs of metal and paint took over that work.',
  'Every sign beside a road today is a quiet copy of those first stones.',
]

describe('explainOrderSeam', () => {
  const item = toCsatOrder(SOURCE, SOURCE.map((_, i) => i))!

  it('정답이 만드는 이음매를 원문에서 인용한다', () => {
    const e = explainOrderSeam(item)
    expect(e).not.toBeNull()
    expect(e!.hasCitation).toBe(true)
    expect(e!.ko).toContain('도입문')
    expect(e!.ko).toMatch(/\(A\)|\(B\)|\(C\)/)
  })

  it('오답이 만드는 이음매를 함께 보인다 — 지어낸 이유가 아니라 인용이다', () => {
    const e = explainOrderSeam(item)!
    expect(e.hasWrongOption).toBe(true)
    expect(e.ko).toContain('원문의 이음매와 다르다')
  })

  it('시장 규격 길이 안에 든다', () => {
    const e = explainOrderSeam(item)!
    expect(e.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })

  it('작성기 이름을 남긴다 — 나중에 배치 해설로 올려칠 수 있어야 한다', () => {
    expect(explainOrderSeam(item)!.writer).toBe('order_seam')
  })
})

describe('explainInsertSeam', () => {
  // 6문장을 남기고 3번째 문장을 뺀다 → 자리 5곳.
  const remaining = SOURCE.filter((_, i) => i !== 2)
  const item = toCsatInsert(remaining, SOURCE[2]!, 2)!

  it('원래 자리를 앞뒤 문장으로 보인다', () => {
    const e = explainInsertSeam(item)
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('원래')
    expect(e!.hasCitation).toBe(true)
  })

  it('오답 자리가 무엇을 갈라놓는지 보인다', () => {
    const e = explainInsertSeam(item)!
    expect(e.hasWrongOption).toBe(true)
    expect(e.ko).toContain('원문에서 이 둘은 붙어 있다')
  })

  it('시장 규격 길이 안에 든다', () => {
    const e = explainInsertSeam(item)!
    expect(e.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })
})

describe('explainShortInsertSeam', () => {
  // 4문장 문단에서 1문장을 빼면 remaining 3 — `toCsatInsert` 는 null 을 준다(자리 5곳 필요).
  const short = SOURCE.slice(0, 4)
  const remaining = short.filter((_, i) => i !== 1)

  it('자리가 5곳이 안 되어도 학습 화면용 해설은 쓴다', () => {
    expect(toCsatInsert(remaining, short[1]!, 1)).toBeNull()
    const e = explainShortInsertSeam(remaining, short[1]!, 1)
    expect(e).not.toBeNull()
    expect(e!.writer).toBe('insert_seam')
    expect(e!.hasCitation).toBe(true)
  })

  it('자리가 범위를 벗어나면 쓰지 않는다', () => {
    expect(explainShortInsertSeam(remaining, short[1]!, 0)).toBeNull()
    expect(explainShortInsertSeam(remaining, short[1]!, 9)).toBeNull()
  })

  it('인용 잔해가 있으면 쓰지 않는다 — 인쇄 규격만 우회하고 안전장치는 그대로다', () => {
    const dirty = ['[] trained the model using a sample set.', ...remaining]
    expect(explainShortInsertSeam(dirty, short[1]!, 2)).toBeNull()
  })
})
