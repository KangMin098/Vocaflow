// apps/web/src/lib/csat/__tests__/item-finder.test.ts
//
// 기출 찾기(FND1 · FND3) 순수 계약 — 조합 검색 · 목적 보존 · 선택 해제 · 응답 allowlist · 이동 주소 · 복귀 주소 검증.
import { describe, expect, it } from 'vitest'

import { EMPTY_FILTER, filterBrowse, type BrowseCatalog, type BrowseExam, type BrowseItem } from '../browse-model'
import { parseQuery, QUERY_MAX } from '../browse-search'
import { browseHref, parseBrowseParams } from '../browse-url'
import {
  applySelection,
  clearFinderOrigin,
  EMPTY_SELECTION,
  FINDER_EXAM_KEYS,
  FINDER_ITEM_KEYS,
  FINDER_TYPE_KEYS,
  finderExams,
  finderItemHref,
  finderItems,
  finderOriginFor,
  parseFinderItemId,
  projectFinderCatalog,
  reconcilePick,
  rememberFinderOrigin,
  safeItemReturn,
  sameSelection,
  selectionFromBrowseHref,
  selectionFromParams,
  selectionHref,
  selectionIsEmpty,
  splitExam,
  withExam,
} from '../item-finder'
import { killerTypeIds } from '../space-model'
import { RECENT_FROM } from '../trap-atlas'

const exam = (id: string, label: string, kind: BrowseExam['kind'], year: number, month: number | null, grade: 1 | 2 | 3 | null = null): BrowseExam => ({ id, label, kind, year, month, grade, items: 0 })
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

const KILLER = killerTypeIds()[0]
const CATALOG: BrowseCatalog = {
  exams: [
    exam('2026', '2026학년도 수능', 'suneung', 2026, null),
    exam('M2609', '2026학년도 9월 모의평가', 'mock', 2026, 9),
    exam('M2606', '2026학년도 6월 모의평가', 'mock', 2026, 6),
    exam('2025', '2025학년도 수능', 'suneung', 2025, null),
    exam('2014A', '2014학년도 수능 A형', 'suneung', 2014, null),
    exam('2014B', '2014학년도 수능 B형', 'suneung', 2014, null),
    exam('H2503G1', '2025년 3월 고1', 'hakpyeong', 2026, 3, 1),
  ],
  types: [
    { id: 'T-BLANK', name: '빈칸 추론', status: 'active', items: 0 },
    { id: 'T-ORDER', name: '글의 순서', status: 'active', items: 0 },
    { id: KILLER, name: '킬러 유형 표본', status: 'active', items: 0 },
  ],
  items: [
    item('2026#34', 'T-BLANK', { points: 3 }),
    item('2026#31', 'T-BLANK'),
    item('2026#37', 'T-ORDER', { lecture: false, sec: 0, map: false }),
    item('M2609#34', 'T-BLANK'),
    item('M2606#31', KILLER),
    item('2025#34', 'T-ORDER'),
    item('2014A#34', 'T-BLANK'),
    item('2014B#34', 'T-BLANK'),
    item('H2503G1#34', 'T-ORDER'),
  ],
  error: null,
}
const ids = (list: BrowseItem[]) => list.map((i) => i.id).sort()
const q = (query: string) => ids(filterBrowse(CATALOG, { ...EMPTY_FILTER, query }))

describe('조합 검색 — 메타데이터 토큰 AND(서가와 팝업이 같은 해석)', () => {
  it('2026 34 · 2026#34 · 2026학년도 34번', () => {
    // 학년도 2026 의 34번 — 수능 · 모평 · 학평(schoolYear 2026)
    expect(q('2026 34')).toEqual(['2026#34', 'H2503G1#34', 'M2609#34'])
    expect(q('2026학년도 34번')).toEqual(['2026#34', 'H2503G1#34', 'M2609#34'])
    // 문항 id 모양은 그 문항 하나
    expect(q('2026#34')).toEqual(['2026#34'])
    expect(q('2026-34')).toEqual(['2026#34'])
    expect(q(' 2026 # 34 ')).toEqual(['2026#34'])
  })

  it('빈칸 2026 — 유형 이름과 학년도를 함께', () => {
    expect(q('빈칸 2026')).toEqual(['2026#31', '2026#34', 'M2609#34'])
  })

  it('모의평가 id · A/B 회차', () => {
    expect(q('M2609')).toEqual(['M2609#34'])
    expect(q('m2609 34')).toEqual(['M2609#34'])
    expect(q('2014A')).toEqual(['2014A#34'])
    expect(q('2014b#34')).toEqual(['2014B#34'])
    expect(q('a형')).toEqual(['2014A#34'])
    expect(q('H2503G1')).toEqual(['H2503G1#34'])
  })

  it('번호는 정확히 — 34 가 134 · 341 · 3 을 뜻하지 않는다', () => {
    expect(q('3')).toEqual([])
    expect(q('134')).toEqual([])
    expect(q('31')).toEqual(['2026#31', 'M2606#31'])
  })

  it('공백 · 빈 검색어는 거르지 않는다 · 모르는 낱말은 0건', () => {
    expect(q('   ')).toHaveLength(CATALOG.items.length)
    expect(q('없는낱말')).toEqual([])
    expect(q('빈칸 없는낱말')).toEqual([])
  })

  it('40자 초과는 주소 계약과 같이 자른다', () => {
    const long = `빈칸 ${'가'.repeat(60)}`
    expect(parseQuery(long).text.length).toBeLessThanOrEqual(QUERY_MAX)
    expect(parseBrowseParams({ q: 'x'.repeat(80) }).query).toHaveLength(QUERY_MAX)
  })

  it('옛 단일 검색(유형 이름 · 회차 이름 일부 · 번호)도 그대로', () => {
    expect(q('빈칸')).toEqual(['2014A#34', '2014B#34', '2026#31', '2026#34', 'M2609#34'])
    expect(q('9월')).toEqual(['M2609#34'])
  })
})

describe('선택 모델 — 필터 + 목적(killer · evidence · recent)', () => {
  it('killer 는 필터 밖 목적으로, 결과는 killerTypeIds 제한과 같다', () => {
    const sel = selectionFromParams({ purpose: 'killer' })
    expect(sel.purpose).toBe('killer')
    expect(sel.filter).toEqual(EMPTY_FILTER)
    const killers = new Set(killerTypeIds())
    // 옛 서가 로직(filterBrowse 뒤 killer 유형만)과 같은 결과
    expect(ids(applySelection(CATALOG, sel))).toEqual(ids(filterBrowse(CATALOG, EMPTY_FILTER).filter((i) => killers.has(i.type_id))))
    expect(ids(applySelection(CATALOG, sel))).toEqual(['M2606#31'])
    // 목적 해제 = 전체 후보로
    expect(applySelection(CATALOG, { ...sel, purpose: null })).toHaveLength(CATALOG.items.length)
  })

  it('evidence · recent 별칭은 status · from 으로 펼친다(목적 상태로 남지 않는다)', () => {
    const ev = selectionFromParams({ purpose: 'evidence' })
    expect(ev).toEqual({ filter: { ...EMPTY_FILTER, status: 'map' }, purpose: null })
    const rc = selectionFromParams({ purpose: 'recent', status: 'lecture' })
    expect(rc).toEqual({ filter: { ...EMPTY_FILTER, from: RECENT_FROM, status: 'lecture' }, purpose: null })
  })

  it('ret 왕복 — 선택 → 서가 주소 → 선택 이 같다(목적 포함)', () => {
    const cases = [
      { filter: { ...EMPTY_FILTER, type: 'T-BLANK', query: '2026 34' }, purpose: 'killer' as const },
      { filter: { ...EMPTY_FILTER, status: 'map' as const }, purpose: null },
      { filter: { ...EMPTY_FILTER, from: RECENT_FROM, kind: 'mock' as const }, purpose: null },
      EMPTY_SELECTION,
    ]
    for (const sel of cases) {
      const href = selectionHref(sel)
      expect(href).toBe(browseHref(sel.filter, sel.purpose))
      expect(sameSelection(selectionFromBrowseHref(href)!, sel)).toBe(true)
    }
  })

  it('카탈로그에 없는 유형 · 회차는 전체로(서가의 기존 동작)', () => {
    const sel = selectionFromParams({ type: 'R-NOPE', exam: 'M9999' }, CATALOG)
    expect(sel.filter.type).toBe('all')
    expect(sel.filter.exam).toBe('all')
  })

  it('조건 초기화는 목적까지 해제한다 — EMPTY_SELECTION 은 목적이 없다', () => {
    expect(EMPTY_SELECTION.purpose).toBeNull()
    expect(selectionIsEmpty(EMPTY_SELECTION)).toBe(true)
    expect(selectionIsEmpty({ filter: EMPTY_FILTER, purpose: 'killer' })).toBe(false)
  })

  it('회차 조건 ↔ 회차 열 선택 — 꺼냈다 다시 실으면 같은 주소', () => {
    const sel = selectionFromParams({ exam: 'M2609', type: 'T-BLANK', purpose: 'killer' })
    const { sel: inner, examId } = splitExam(sel)
    expect(examId).toBe('M2609')
    expect(inner.filter.exam).toBe('all')
    expect(inner.purpose).toBe('killer')
    expect(selectionHref(withExam(inner, examId))).toBe(selectionHref(sel))
    expect(withExam(inner, null).filter.exam).toBe('all')
  })

  it('서가 주소가 아닌 ret 는 받지 않는다', () => {
    expect(selectionFromBrowseHref('https://evil.example/csat/browse')).toBeNull()
    expect(selectionFromBrowseHref('/csat/item/2026-34')).toBeNull()
    expect(selectionFromBrowseHref(null)).toBeNull()
  })
})

describe('회차 · 문항 열과 선택 해제', () => {
  it('회차를 안 고르면 일치 문항 전부(회차 순 · 번호 순), 고르면 그 회차만', () => {
    const r = applySelection(CATALOG, { filter: { ...EMPTY_FILTER, query: '34' }, purpose: null })
    expect(finderExams(CATALOG, r).map((e) => e.exam.id)).toEqual(['2026', 'M2609', '2025', '2014A', '2014B', 'H2503G1'])
    expect(finderItems(CATALOG, r, null)[0].id).toBe('2026#34')
    expect(finderItems(CATALOG, r, 'M2609').map((i) => i.id)).toEqual(['M2609#34'])
  })

  it('결과에 없는 회차 · 문항 선택은 해제된다', () => {
    const r = applySelection(CATALOG, { filter: { ...EMPTY_FILTER, kind: 'mock' }, purpose: null })
    expect(reconcilePick(r, '2026', '2026#34')).toEqual({ examId: null, itemId: null })
    expect(reconcilePick(r, 'M2609', 'M2609#34')).toEqual({ examId: 'M2609', itemId: 'M2609#34' })
    // 회차와 맞지 않는 문항
    expect(reconcilePick(r, 'M2609', 'M2606#31')).toEqual({ examId: 'M2609', itemId: null })
    // 검색 0건
    expect(reconcilePick([], 'M2609', 'M2609#34')).toEqual({ examId: null, itemId: null })
  })
})

describe('응답 모양 — allowlist · 보류 제외 · 개수 다시 세기', () => {
  it('정답 · 발문 · 분석 키가 섞여 와도 allowlist 키만 싣는다', () => {
    const dirty = { ...CATALOG, items: CATALOG.items.map((i) => ({ ...i, answer: 3, stem: '원문', why_correct: '해설', script: '대본' })) } as unknown as BrowseCatalog
    const out = projectFinderCatalog(dirty, () => false)
    for (const i of out.items) expect(Object.keys(i).sort()).toEqual([...FINDER_ITEM_KEYS].sort())
    for (const e of out.exams) expect(Object.keys(e).sort()).toEqual([...FINDER_EXAM_KEYS].sort())
    for (const t of out.types) expect(Object.keys(t).sort()).toEqual([...FINDER_TYPE_KEYS].sort())
    expect(JSON.stringify(out)).not.toMatch(/원문|해설|대본|answer|stem/)
  })

  it('보류 문항을 빼고 회차 · 유형 개수를 다시 센다 — 비는 회차 · 유형은 빠진다', () => {
    const out = projectFinderCatalog(CATALOG, (id) => id.startsWith('M2609#') || id === '2026#37')
    expect(out.items.map((i) => i.id)).not.toContain('M2609#34')
    expect(out.exams.map((e) => e.id)).not.toContain('M2609')
    expect(out.exams.find((e) => e.id === '2026')!.items).toBe(2)
    expect(out.types.find((t) => t.id === 'T-BLANK')!.items).toBe(4)
    expect(out.types.find((t) => t.id === 'T-ORDER')!.items).toBe(2)
  })
})

describe('이동 주소 — 기본 장면 + 검증된 복귀 문맥만', () => {
  it('pair · back · meaning · rel · check 는 넘기지 않고 ret · from=map · task 만', () => {
    const href = finderItemHref('M2609#34', { ret: '/csat/browse?type=T-BLANK&purpose=killer', fromMap: true, mapCtxQuery: '&task=t.abc&ws=ws.read&step=evidence' })
    const u = new URL(href, 'http://x')
    expect(u.pathname).toBe('/csat/item/M2609-34')
    expect(u.searchParams.get('scene')).toBe('task')
    expect(u.searchParams.get('ret')).toBe('/csat/browse?type=T-BLANK&purpose=killer')
    expect(u.searchParams.get('from')).toBe('map')
    expect(u.searchParams.get('task')).toBe('t.abc')
    for (const k of ['pair', 'back', 'meaning', 'rel', 'depth', 'bridge', 'check']) expect(u.searchParams.has(k)).toBe(false)
  })

  it('외부 · 서가 아닌 ret 와 모양이 틀린 지도 조각은 버린다', () => {
    const u = new URL(finderItemHref('2026#34', { ret: 'https://evil.example', fromMap: true, mapCtxQuery: '&check=1' }), 'http://x')
    expect(u.searchParams.has('ret')).toBe(false)
    expect(u.searchParams.has('check')).toBe(false)
    expect(new URL(finderItemHref('2026#34', { ret: '//evil.example/csat/browse' }), 'http://x').searchParams.has('ret')).toBe(false)
    expect(new URL(finderItemHref('2026#34', {}), 'http://x').searchParams.has('from')).toBe(false)
  })

  it('문항 id 형식', () => {
    expect(parseFinderItemId('2026#34')).toBe('2026#34')
    expect(parseFinderItemId('2014A#34')).toBe('2014A#34')
    expect(parseFinderItemId('H2503G1#5')).toBe('H2503G1#5')
    for (const bad of ['2026#134', '2026-34', '../2026#34', 'X2026#3', '', null]) expect(parseFinderItemId(bad)).toBeNull()
  })
})

describe('「찾기 전 문항으로」 주소 검증 · 탭 메모리', () => {
  it('내부 문항 경로 + 허용 쿼리만 남긴다(check 는 빠진다)', () => {
    expect(safeItemReturn('/csat/item/2026-34?scene=meaning&meaning=u2&check=1&evil=1')).toBe('/csat/item/2026-34?scene=meaning&meaning=u2')
    const withRet = safeItemReturn(`/csat/item/2026-34?scene=compare&pair=p1&back=M2609-34&ret=${encodeURIComponent('/csat/browse?q=빈칸')}`)!
    expect(new URL(withRet, 'http://x').searchParams.get('ret')).toBe('/csat/browse?q=빈칸')
    expect(new URL(withRet, 'http://x').searchParams.get('pair')).toBe('p1')
  })

  it('외부 · javascript: · 다른 경로 · 다중 인코딩 · 서가 아닌 ret 를 거른다', () => {
    for (const bad of [
      'https://evil.example/csat/item/2026-34',
      '//evil.example/csat/item/2026-34',
      'javascript:alert(1)',
      '/csat/browse?type=X',
      '/csat/item/2026-34/../../admin',
      '/csat/item/2026-134',
      '/csat/item/2026-34?scene=%252e%252e',
      '/csat/item/2026-34\\evil',
    ]) {
      expect(safeItemReturn(bad), bad).toBeNull()
    }
    expect(safeItemReturn('/csat/item/2026-34?ret=https%3A%2F%2Fevil.example')).toBe('/csat/item/2026-34')
  })

  it('도착 문항에서만 원래 주소를 돌려준다', () => {
    clearFinderOrigin()
    rememberFinderOrigin('/csat/item/2026-34?scene=meaning&meaning=u2', 'M2609#34')
    expect(finderOriginFor('M2609#34')).toBe('/csat/item/2026-34?scene=meaning&meaning=u2')
    expect(finderOriginFor('2026#34')).toBeNull()
    rememberFinderOrigin('https://evil.example', 'M2609#34')
    expect(finderOriginFor('M2609#34')).toBeNull()
  })
})
