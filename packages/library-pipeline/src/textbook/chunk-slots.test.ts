// packages/library-pipeline/src/textbook/chunk-slots.test.ts
//
// 드레인 청크 번호 고르기 회귀. 지키려는 것은 **남의 자리를 덮지 않는가** 다.
//
// 실측 2026-09-06: `item-drain-export.mjs` 가 끝낸 청크의 `.json` 을 지운 뒤 그 번호를
// "비었다" 로 보고 새 몫을 썼다. 남아 있던 `.out.json` 과 짝이 어긋나
// `blank-v4/chunk-00.json` 은 새 글 5편, `chunk-00.out.json` 은 옛 글 8편이 됐다.

import { describe, expect, it } from 'vitest'
// 정본은 스크립트 쪽에 있다 — 사본을 두면 둘이 갈린다.
import { pickFreeSlots, slotOf, takenSlots } from '../../../../scripts/textbook/chunk-slots.mjs'

describe('드레인 청크 번호', () => {
  it('청크 파일에서 번호를 읽는다', () => {
    expect(slotOf('chunk-00.json')).toBe(0)
    expect(slotOf('chunk-07.out.json')).toBe(7)
    expect(slotOf('chunk-123.json')).toBe(123)
    expect(slotOf('notes.json')).toBeNull()
    expect(slotOf('chunk-00.json.bak')).toBeNull()
  })

  it('`.out.json` 만 남은 번호도 임자가 있는 것으로 센다', () => {
    // 이것이 실제로 일어난 일이다 — 끝낸 청크의 .json 을 지우면 .out.json 만 남는다.
    expect(takenSlots(['chunk-00.out.json'])).toEqual(new Set([0]))
    expect(pickFreeSlots(['chunk-00.out.json'], 1)).toEqual(['01'])
  })

  it('빈 번호부터 앞에서 채운다', () => {
    expect(pickFreeSlots([], 3)).toEqual(['00', '01', '02'])
  })

  it('아직 안 채운 청크를 건너뛴다', () => {
    expect(pickFreeSlots(['chunk-00.json', 'chunk-02.json'], 2)).toEqual(['01', '03'])
  })

  it('구멍이 있으면 그 구멍부터 쓴다', () => {
    const files = ['chunk-00.json', 'chunk-00.out.json', 'chunk-01.json', 'chunk-03.json']
    expect(pickFreeSlots(files, 3)).toEqual(['02', '04', '05'])
  })

  it('두 자리로 채운다 — 정렬해서 보기 위해서다', () => {
    expect(pickFreeSlots([], 1)).toEqual(['00'])
    const many = Array.from({ length: 10 }, (_, i) => `chunk-${String(i).padStart(2, '0')}.json`)
    expect(pickFreeSlots(many, 1)).toEqual(['10'])
  })
})
