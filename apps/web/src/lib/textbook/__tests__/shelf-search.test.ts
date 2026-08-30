// apps/web/src/lib/textbook/__tests__/shelf-search.test.ts
//
// 매대의 찾기·줄세우기·좁히기.
//
// 여기서 지키는 것:
//   ① **정렬은 전순서** — 비교값이 같아도 순서가 흔들리지 않는다(계단 번호로 끊는다).
//   ② **검색은 AND** — 토큰을 더할수록 결과가 줄어야 한다. 늘어나면 좁히기가 아니다.
//   ③ **유형 한글 이름으로도 찾힌다** — 학습자는 'blank_word' 가 아니라 '빈칸' 으로 찾는다.
//   ④ **못 잰 권을 필터가 숨기지 않는다** — 0 과 '못 잼' 을 같게 취급하는 것이 이 화면의 원죄다.

import { describe, expect, it } from 'vitest'

import type { ShelfVolume } from '../shelf'
import {
  DEFAULT_SORT,
  SHELF_SORTS,
  SHELF_VIEWS,
  onlyReady,
  searchVolumes,
  sortVolumes,
} from '../shelf-search'

function vol(over: Partial<ShelfVolume>): ShelfVolume {
  return {
    step: 1,
    title: '제목',
    schoolBand: '중1',
    vLevels: [3],
    types: ['vocab_choice'],
    rationale: '',
    itemCount: 100,
    byType: {},
    emptyTypes: [],
    status: 'ready',
    maxUnits: 10,
    bySource: {},
    ...over,
  }
}

describe('sortVolumes', () => {
  it('기본은 계단 순이다', () => {
    const vs = [vol({ step: 3 }), vol({ step: 1 }), vol({ step: 2 })]
    expect(sortVolumes(vs, DEFAULT_SORT).map((v) => v.step)).toEqual([1, 2, 3])
  })

  it('원본 배열을 건드리지 않는다 — 호출부가 useMemo 로 캐시한다', () => {
    const vs = [vol({ step: 3 }), vol({ step: 1 })]
    sortVolumes(vs, 'step')
    expect(vs.map((v) => v.step)).toEqual([3, 1])
  })

  it('모르는 정렬 id 는 기본 정렬로 떨어진다 — URL 이 오염돼도 화면은 산다', () => {
    const vs = [vol({ step: 2 }), vol({ step: 1 })]
    expect(sortVolumes(vs, 'no-such-sort').map((v) => v.step)).toEqual([1, 2])
  })

  it('문항 많은 순 — 같은 수면 계단 번호로 끊는다(전순서)', () => {
    const vs = [
      vol({ step: 5, itemCount: 100 }),
      vol({ step: 2, itemCount: 900 }),
      vol({ step: 3, itemCount: 100 }),
    ]
    expect(sortVolumes(vs, 'items').map((v) => v.step)).toEqual([2, 3, 5])
  })

  it('유형 많은 순 — 같은 수면 계단 번호로 끊는다', () => {
    const vs = [
      vol({ step: 4, types: ['a', 'b'] }),
      vol({ step: 1, types: ['a', 'b'] }),
      vol({ step: 7, types: ['a', 'b', 'c'] }),
    ]
    expect(sortVolumes(vs, 'types').map((v) => v.step)).toEqual([7, 1, 4])
  })

  it('모든 정렬이 전순서다 — 어떤 입력 순서로 넣어도 결과가 같다', () => {
    const base = [
      vol({ step: 1, title: '가', itemCount: 50, types: ['a'] }),
      vol({ step: 2, title: '나', itemCount: 50, types: ['a'] }),
      vol({ step: 3, title: '다', itemCount: 50, types: ['a'] }),
    ]
    for (const sort of SHELF_SORTS) {
      const forward = sortVolumes(base, sort.id).map((v) => v.step)
      const reversed = sortVolumes([...base].reverse(), sort.id).map((v) => v.step)
      expect(reversed, `${sort.id} 가 입력 순서에 흔들린다`).toEqual(forward)
    }
  })

  it('정렬 id 가 중복되지 않는다 — URL 키로 쓰므로', () => {
    expect(new Set(SHELF_SORTS.map((s) => s.id)).size).toBe(SHELF_SORTS.length)
  })
})

describe('searchVolumes', () => {
  const shelf = [
    vol({ step: 1, title: 'Vocaflow Reading Starter', schoolBand: '초등 저학년', vLevels: [1], types: ['rhyme'] }),
    vol({ step: 4, title: 'Vocaflow Reading 3', schoolBand: '중학 3학년', vLevels: [4], types: ['blank_word'] }),
    vol({ step: 6, title: 'Vocaflow Reading 5', schoolBand: '고2', vLevels: [6], types: ['insert'] }),
  ]

  it('빈 검색어는 전부 돌려준다', () => {
    expect(searchVolumes(shelf, '   ')).toHaveLength(3)
  })

  it('제목으로 찾는다', () => {
    expect(searchVolumes(shelf, 'Starter').map((v) => v.step)).toEqual([1])
  })

  it('대소문자를 가리지 않는다', () => {
    expect(searchVolumes(shelf, 'starter').map((v) => v.step)).toEqual([1])
  })

  it('학령으로 찾는다', () => {
    expect(searchVolumes(shelf, '중학').map((v) => v.step)).toEqual([4])
  })

  it('V레벨로 찾는다', () => {
    expect(searchVolumes(shelf, 'V6').map((v) => v.step)).toEqual([6])
  })

  it('유형 **한글 이름**으로 찾는다 — 학습자는 코드를 모른다', () => {
    expect(searchVolumes(shelf, '빈칸').map((v) => v.step)).toEqual([4])
  })

  it('토큰을 더하면 결과가 줄어든다 (AND) — 늘어나면 좁히기가 아니다', () => {
    const one = searchVolumes(shelf, 'Reading')
    const two = searchVolumes(shelf, 'Reading 3')
    expect(one.length).toBeGreaterThan(two.length)
    expect(two.map((v) => v.step)).toEqual([4])
  })

  it('걸리는 게 없으면 빈 배열 — 전체로 되돌아가지 않는다', () => {
    expect(searchVolumes(shelf, '없는낱말')).toEqual([])
  })
})

describe('onlyReady', () => {
  const shelf = [
    vol({ step: 1, status: 'ready' }),
    vol({ step: 2, status: 'building' }),
    vol({ step: 3, status: 'empty' }),
    vol({ step: 4, status: 'unmeasured' }),
  ]

  it('꺼져 있으면 전부 보여 준다', () => {
    expect(onlyReady(shelf, false)).toHaveLength(4)
  })

  it('켜면 준비 중·근간 예정을 숨긴다', () => {
    expect(onlyReady(shelf, true).map((v) => v.step)).toContain(1)
    expect(onlyReady(shelf, true).map((v) => v.step)).not.toContain(2)
    expect(onlyReady(shelf, true).map((v) => v.step)).not.toContain(3)
  })

  it('⚠️ **못 잰 권은 숨기지 않는다** — 못 잰 것을 "준비 안 됨" 으로 적으면 그 화면은 거짓말한다', () => {
    expect(onlyReady(shelf, true).map((v) => v.step)).toContain(4)
  })
})

describe('SHELF_VIEWS', () => {
  it('목록과 격자 두 가지다', () => {
    expect(SHELF_VIEWS.map((v) => v.id)).toEqual(['list', 'grid'])
  })
})
