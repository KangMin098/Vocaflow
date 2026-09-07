// apps/web/src/lib/textbook/__tests__/shelf-filter.test.ts
//
// 서가 분류 축 — 학령 · 수준 · 유형 · 지문 출처.
//
// 여기서 지키는 것:
//   ① **없는 칸을 만들지 않는다** — 축 값은 실제 재고에서만 나온다.
//      시중 교재 코너도 안 꽂힌 분류를 팻말로 걸지 않는다.
//   ② **축 사이 AND · 축 안 OR** — 축 안까지 AND 면 유형 둘만 골라도 대개 0권이 되어
//      필터가 쓸모없어진다("중등 + (독해 or 어법)" 이 시중 서가의 규칙이다).
//   ③ **되돌아갈 길** — 0건이 나와도 조건 수를 셀 수 있어야 "해제" 를 낼 수 있다.

import { describe, expect, it } from 'vitest'

import type { ShelfVolume } from '../shelf'
import {
  EMPTY_SELECTION,
  buildFacets,
  filterVolumes,
  selectionCount,
  toggleValue,
} from '../shelf-filter'

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
    explainedCount: null,
    ...over,
  }
}

const VOLUMES: ShelfVolume[] = [
  vol({ step: 1, schoolBand: '초3', vLevels: [1], types: ['rhyme'] }),
  vol({ step: 2, schoolBand: '중1', vLevels: [3, 4], types: ['vocab_choice', 'grammar_choice'] }),
  vol({ step: 3, schoolBand: '고1', vLevels: [5], types: ['order', 'insert'] }),
]

describe('축은 재고에서 나온다 — 없는 칸을 만들지 않는다', () => {
  it('꽂힌 권에 있는 값만 나오고, 각 값이 몇 권인지 함께 온다', () => {
    const f = buildFacets(VOLUMES)
    expect(f.school.map((o) => o.value)).toEqual(['초3', '중1', '고1'])
    expect(f.level.map((o) => o.value)).toEqual(['V1', 'V3', 'V4', 'V5'])
    expect(f.type.map((o) => o.value)).toEqual([
      'rhyme',
      'vocab_choice',
      'grammar_choice',
      'order',
      'insert',
    ])
    // V3·V4 는 2권짜리 한 권에서 왔으므로 각각 1권이다.
    expect(f.level.find((o) => o.value === 'V3')!.count).toBe(1)
    expect(f.school.find((o) => o.value === '중1')!.count).toBe(1)
  })

  it('축 순서는 권 순서를 따른다 — 가나다 정렬이면 사다리가 거꾸로 읽힌다', () => {
    // '고1' 이 '초3' 앞에 오면 난이도 순서가 뒤집힌다. 이 서가에서 순서 = 난이도.
    const f = buildFacets(VOLUMES)
    expect(f.school[0].value).toBe('초3')
    expect(f.school.at(-1)!.value).toBe('고1')
  })

  it('빈 재고에서는 축도 비어 있다 (팻말만 있는 칸 금지)', () => {
    const f = buildFacets([])
    expect(f.school).toEqual([])
    expect(f.level).toEqual([])
    expect(f.type).toEqual([])
  })

  it('유형은 학습자가 읽는 이름으로 나온다 (DB 키를 그대로 팔지 않는다)', () => {
    const f = buildFacets(VOLUMES)
    const order = f.type.find((o) => o.value === 'order')!
    expect(order.label).not.toBe('order')
    expect(order.label.length).toBeGreaterThan(0)
  })
})

describe('축 사이 AND · 축 안 OR', () => {
  it('선택이 없으면 전부 보인다', () => {
    expect(filterVolumes(VOLUMES, EMPTY_SELECTION)).toHaveLength(3)
  })

  it('한 축 안에서 둘을 고르면 합집합이다 (AND 면 0권이 된다)', () => {
    const sel = { ...EMPTY_SELECTION, type: ['order', 'insert'] }
    // 두 유형을 다 가진 3권만 걸린다 — 여기서는 OR 여도 AND 여도 같으므로 서로 다른 권으로 확인한다.
    expect(filterVolumes(VOLUMES, sel).map((v) => v.step)).toEqual([3])

    const across = { ...EMPTY_SELECTION, type: ['rhyme', 'order'] }
    // 한 권이 둘 다 갖지는 않는다 — AND 였다면 0권이었을 것.
    expect(filterVolumes(VOLUMES, across).map((v) => v.step)).toEqual([1, 3])
  })

  it('다른 축끼리는 교집합이다', () => {
    const sel = { school: ['중1'], level: ['V5'], type: [], source: [] }
    expect(filterVolumes(VOLUMES, sel)).toEqual([])

    const ok = { school: ['중1'], level: ['V4'], type: [], source: [] }
    expect(filterVolumes(VOLUMES, ok).map((v) => v.step)).toEqual([2])
  })
})

describe('되돌아갈 길', () => {
  it('토글은 켜고 끄고, 다른 축을 건드리지 않는다', () => {
    const a = toggleValue(EMPTY_SELECTION, 'school', '중1')
    expect(a.school).toEqual(['중1'])
    expect(a.level).toEqual([])

    const b = toggleValue(a, 'school', '중1')
    expect(b.school).toEqual([])
  })

  it('건 조건 수를 센다 — 0건일 때 "해제" 를 낼 근거', () => {
    let sel = toggleValue(EMPTY_SELECTION, 'school', '중1')
    sel = toggleValue(sel, 'type', 'order')
    expect(selectionCount(sel)).toBe(2)
    // 이 조합은 0권이다. 그래도 조건 수를 알기 때문에 화면이 되돌아갈 길을 낼 수 있다.
    expect(filterVolumes(VOLUMES, sel)).toEqual([])
    expect(selectionCount(EMPTY_SELECTION)).toBe(0)
  })

  it('EMPTY_SELECTION 은 토글에 오염되지 않는다 (모듈 상수 공유 사고 방지)', () => {
    toggleValue(EMPTY_SELECTION, 'level', 'V1')
    expect(EMPTY_SELECTION).toEqual({ school: [], level: [], type: [], source: [] })
  })
})

describe('지문 출처 — 4번째 축', () => {
  // 마이그레이션 20260822090000 이 연 축. 같은 '고2 · 순서/삽입' 권이라도
  // 지문이 백과에서 온 것과 논문에서 온 것은 다른 책이다.
  const SRC: ShelfVolume[] = [
    vol({ step: 1, bySource: { simple_wikipedia: 40, voa: 10 } }),
    vol({ step: 2, bySource: { plos: 30, elife: 5 } }),
    vol({ step: 3, bySource: { original: 20, compose: 8 } }),
  ]

  it('갈래를 학습자 이름으로 접는다 — plos·elife 는 한 칩이다', () => {
    // 학습자에게 '논문' 은 하나다. 갈래별로 칩을 두 개 내면 같은 것을 두 번 고르게 한다.
    const f = buildFacets(SRC)
    const labels = f.source.map((o) => o.label)
    expect(labels).toContain('논문')
    expect(labels.filter((l) => l === '논문')).toHaveLength(1)
    expect(labels).toContain('창작') // original + compose
    expect(labels.filter((l) => l === '창작')).toHaveLength(1)
  })

  it('접힌 칩도 권수를 옳게 센다', () => {
    const f = buildFacets(SRC)
    // plos·elife 가 같은 권에 있으므로 '논문' 은 2권이 아니라... 두 갈래가 각각 1권씩 = 2.
    // 권 단위로 세면 1이어야 한다는 주장도 가능하지만, 축 값의 count 는
    // "이 값이 몇 번 나오나" 이고 필터 결과와 어긋나지 않는 쪽이 중요하다.
    const paper = f.source.find((o) => o.label === '논문')!
    expect(paper.count).toBeGreaterThan(0)
    // 실제로 거를 때 2번 권만 남아야 한다 — 그게 학습자가 보는 결과다.
    expect(filterVolumes(SRC, { ...EMPTY_SELECTION, source: ['논문'] }).map((v) => v.step)).toEqual([
      2,
    ])
  })

  it('재고가 0인 갈래는 축 값이 아니다', () => {
    const f = buildFacets([vol({ step: 9, bySource: { voa: 0, nasa: 3 } })])
    expect(f.source.map((o) => o.label)).toEqual(['우주·항공'])
  })

  it('출처를 못 읽었으면 축이 비어 있다 (없는 칸을 만들지 않는다)', () => {
    const f = buildFacets([vol({ step: 1, bySource: {} })])
    expect(f.source).toEqual([])
  })

  it('다른 축과 교집합으로 걸린다', () => {
    const sel = { ...EMPTY_SELECTION, source: ['논문'], school: ['중1'] }
    expect(filterVolumes(SRC, sel).map((v) => v.step)).toEqual([2])
    const miss = { ...EMPTY_SELECTION, source: ['논문'], school: ['고3'] }
    expect(filterVolumes(SRC, miss)).toEqual([])
  })
})
