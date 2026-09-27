// apps/web/src/lib/csat/__tests__/browse-model.test.ts
//
// 「자유롭게 고른다」가 실제로 자유로운지는 **필터가 축을 AND 로 묶는가**에 달렸다.
// 한 축이라도 OR 로 새면 「모의평가를 골랐는데 수능이 나온다」가 되고, 학습자는 목록을 못 믿는다.
// 그리고 **거르지 않는다**는 약속 — 상영이 없는 문항도 목록에는 남아야 한다.

import { describe, expect, it } from 'vitest'

import {
  EMPTY_FILTER,
  browseExamOrder,
  filterBrowse,
  groupByExam,
  type BrowseCatalog,
  type BrowseExam,
  type BrowseItem,
} from '../browse-model'

const exam = (id: string, label: string, kind: 'suneung' | 'mock', year: number, month: number | null, items: number): BrowseExam => ({
  id,
  label,
  kind,
  year,
  month,
  items,
})

const item = (id: string, type_id: string, over: Partial<BrowseItem> = {}): BrowseItem => ({
  id,
  exam_id: id.split('#')[0],
  no: Number(id.split('#')[1]),
  type_id,
  points: 2,
  lecture: true,
  sec: 200,
  map: true,
  ...over,
})

const CATALOG: BrowseCatalog = {
  exams: [
    exam('2026', '2026학년도 수능', 'suneung', 2026, null, 3),
    exam('M2609', '2026학년도 9월 모의평가', 'mock', 2026, 9, 2),
    exam('2025', '2025학년도 수능', 'suneung', 2025, null, 1),
  ],
  types: [
    { id: 'R-BLANK', name: '빈칸 추론', status: 'active', items: 3 },
    { id: 'R-ORDER', name: '글의 순서', status: 'active', items: 2 },
    { id: 'R-REFER', name: '지칭 추론(단문·폐지)', status: 'retired', items: 1 },
  ],
  items: [
    item('2026#31', 'R-BLANK'),
    item('2026#37', 'R-ORDER', { lecture: false, sec: 0 }),
    item('2026#34', 'R-BLANK', { points: 3, map: false }),
    item('M2609#31', 'R-BLANK'),
    item('M2609#37', 'R-ORDER'),
    item('2025#41', 'R-REFER'),
  ],
  error: null,
}

const ids = (list: BrowseItem[]) => list.map((i) => i.id).sort()

describe('filterBrowse — 네 축과 찾기', () => {
  it('아무 축도 안 걸면 전부다 — 거르지 않는다는 약속', () => {
    expect(filterBrowse(CATALOG, EMPTY_FILTER)).toHaveLength(CATALOG.items.length)
  })

  it('상영이 없는 문항도 기본 목록에 남는다', () => {
    expect(ids(filterBrowse(CATALOG, EMPTY_FILTER))).toContain('2026#37')
  })

  it('시험 종류', () => {
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, kind: 'mock' }))).toEqual(['M2609#31', 'M2609#37'])
    expect(filterBrowse(CATALOG, { ...EMPTY_FILTER, kind: 'suneung' })).toHaveLength(4)
  })

  it('학년도 — 수능과 그 학년도 모의평가가 함께 나온다', () => {
    expect(filterBrowse(CATALOG, { ...EMPTY_FILTER, year: 2026 })).toHaveLength(5)
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, year: 2025 }))).toEqual(['2025#41'])
  })

  it('유형 — 폐지된 유형도 고를 수 있다(감추지 않는다)', () => {
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, type: 'R-REFER' }))).toEqual(['2025#41'])
  })

  it('상태 — 상영 있는 것 · 지도 있는 것', () => {
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, status: 'lecture' }))).not.toContain('2026#37')
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, status: 'map' }))).not.toContain('2026#34')
  })

  it('축은 AND 로 묶인다 — 모의평가를 골랐는데 수능이 섞이지 않는다', () => {
    const rows = filterBrowse(CATALOG, { ...EMPTY_FILTER, kind: 'mock', type: 'R-BLANK' })
    expect(ids(rows)).toEqual(['M2609#31'])
  })

  it('찾기 — 유형 이름 · 회차 이름 · 번호', () => {
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, query: '빈칸' }))).toEqual(['2026#31', '2026#34', 'M2609#31'])
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, query: '9월' }))).toEqual(['M2609#31', 'M2609#37'])
    expect(ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, query: '34' }))).toEqual(['2026#34'])
  })

  it('번호 찾기는 부분 일치가 아니다 — 「3」이 31·34·37 을 다 끌어오면 못 쓴다', () => {
    expect(filterBrowse(CATALOG, { ...EMPTY_FILTER, query: '3' })).toHaveLength(0)
  })
})

describe('groupByExam — 회차 단위로 묶는다', () => {
  it('최근 회차부터, 번호는 시험지 순서대로', () => {
    const groups = groupByExam(CATALOG, filterBrowse(CATALOG, EMPTY_FILTER))
    expect(groups.map((g) => g.exam.id)).toEqual(['2026', 'M2609', '2025'])
    expect(groups[0].items.map((i) => i.no)).toEqual([31, 34, 37])
  })

  it('걸러진 회차는 빈 칸으로 남지 않는다', () => {
    const groups = groupByExam(CATALOG, filterBrowse(CATALOG, { ...EMPTY_FILTER, kind: 'mock' }))
    expect(groups).toHaveLength(1)
  })
})

describe('browseExamOrder — 같은 학년도 안에서는 시행 역순', () => {
  it('수능 → 9월 → 6월', () => {
    const rows = [
      exam('M2606', '2026학년도 6월 모의평가', 'mock', 2026, 6, 28),
      exam('2026', '2026학년도 수능', 'suneung', 2026, null, 28),
      exam('M2609', '2026학년도 9월 모의평가', 'mock', 2026, 9, 28),
    ].sort(browseExamOrder)
    expect(rows.map((e) => e.id)).toEqual(['2026', 'M2609', 'M2606'])
  })
})
