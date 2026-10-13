// apps/web/src/lib/csat/__tests__/browse-url.test.ts
//
// 기출 탐구 조건 ↔ 주소 — 닫힌 값만 · 왕복 · 문항에서 돌아올 주소 검증
import { describe, expect, it } from 'vitest'

import { EMPTY_FILTER } from '../browse-model'
import { browseHref, browseReturn, parseBrowseParams } from '../browse-url'

describe('parseBrowseParams', () => {
  it('닫힌 값 · 범위 안 숫자만', () => {
    expect(parseBrowseParams({ purpose: 'killer', status: 'map', from: '2023', kind: 'hakpyeong', grade: '3', year: '2026', type: 'R-BLANK', exam: '2026', q: 'x'.repeat(60) })).toEqual({
      purpose: 'killer', status: 'map', from: 2023, kind: 'hakpyeong', grade: 3, year: 2026, type: 'R-BLANK', exam: '2026', query: 'x'.repeat(40),
    })
  })
  it('모르는 값 · 범위 밖 · 학평이 아닌 학년 · 이상한 id 는 버린다', () => {
    expect(parseBrowseParams({ purpose: 'evil', status: 'x', from: '1999', kind: 'x', grade: '3', year: '3000', type: '../x', exam: '<s>' })).toEqual({
      purpose: undefined, status: undefined, from: undefined, kind: undefined, grade: undefined, year: undefined, type: undefined, exam: undefined, query: undefined,
    })
    expect(parseBrowseParams({ kind: 'mock', grade: '2' }).grade).toBeUndefined()
  })
})

describe('browseHref — 기본값은 싣지 않고 왕복한다', () => {
  it('빈 조건 → /csat/browse', () => {
    expect(browseHref(EMPTY_FILTER, null)).toBe('/csat/browse')
  })
  it('조건 → 주소 → 파서가 같은 값', () => {
    const f = { ...EMPTY_FILTER, type: 'R-BLANK', status: 'map' as const, from: 2023, kind: 'suneung' as const, year: 2026, query: ' 빈칸 ' }
    const href = browseHref(f, 'killer')
    expect(href).toBe('/csat/browse?purpose=killer&type=R-BLANK&status=map&from=2023&kind=suneung&year=2026&q=%EB%B9%88%EC%B9%B8')
    const p = parseBrowseParams(Object.fromEntries(new URL(`http://x${href}`).searchParams))
    expect(p).toMatchObject({ purpose: 'killer', type: 'R-BLANK', status: 'map', from: 2023, kind: 'suneung', year: 2026, query: '빈칸' })
  })
})

describe('browseReturn — 서가 경로만', () => {
  it('허용', () => {
    expect(browseReturn('/csat/browse')).toBe('/csat/browse')
    expect(browseReturn('/csat/browse?type=R-BLANK&status=map')).toBe('/csat/browse?type=R-BLANK&status=map')
  })
  it('거부 — 외부 · 다른 내부 경로 · 접두만 같은 경로', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/csat', '/csat/browsex', '/admin', '/csat/browse/../admin?x', null, undefined]) {
      expect(browseReturn(bad as string | null | undefined), String(bad)).toBeNull()
    }
  })
})
