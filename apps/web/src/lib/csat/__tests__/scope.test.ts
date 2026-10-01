// apps/web/src/lib/csat/__tests__/scope.test.ts
import { describe, expect, it } from 'vitest'
import { examFilter, inScope, itemIdFilter, KICE_SCOPE, parseScope, reportKey, sameScope, scopeLabel, scopeQuery, withScope } from '../scope'

describe('범위 — 평가원 / 학평 학년', () => {
  it('URL 해석: 기본 평가원 · 학평 학년 잘못이면 고3', () => {
    expect(parseScope({})).toEqual(KICE_SCOPE)
    expect(parseScope({ set: 'hakpyeong', grade: '1' })).toEqual({ set: 'hakpyeong', grade: 1 })
    expect(parseScope(new URLSearchParams('set=hakpyeong&grade=9'))).toEqual({ set: 'hakpyeong', grade: 3 })
    expect(parseScope({ set: 'kice', grade: '2' })).toEqual(KICE_SCOPE)
  })
  it('URL 조각·이름 — 평가원은 싣지 않는다', () => {
    expect(scopeQuery(KICE_SCOPE)).toBe('')
    expect(withScope('/admin/kice', { set: 'hakpyeong', grade: 2 })).toBe('/admin/kice?set=hakpyeong&grade=2')
    expect(withScope('/admin/kice?x=1', { set: 'hakpyeong', grade: 2 })).toBe('/admin/kice?x=1&set=hakpyeong&grade=2')
    expect(scopeLabel({ set: 'hakpyeong', grade: 3 })).toBe('학평 고3')
    expect(sameScope({ set: 'hakpyeong', grade: 1 }, { set: 'hakpyeong', grade: 2 })).toBe(false)
  })
  it('질의 조건 — 문항 id · 회차 · 유형 리포트 키', () => {
    expect(itemIdFilter(KICE_SCOPE)).toEqual({ op: 'not.like', pattern: 'H%' })
    expect(itemIdFilter({ set: 'hakpyeong', grade: 3 })).toEqual({ op: 'like', pattern: 'H____G3%' })
    expect(examFilter({ set: 'hakpyeong', grade: 1 })).toEqual({ organizer: 'edu_office', grade: 1 })
    expect(reportKey(KICE_SCOPE)).toEqual({ organizer: 'kice', grade: 0 })
    expect(reportKey({ set: 'hakpyeong', grade: 2 })).toEqual({ organizer: 'edu_office', grade: 2 })
  })
  it('받아 온 id 거르기 — 질의 조건과 같은 판정', () => {
    expect(inScope('2026#31', KICE_SCOPE)).toBe(true)
    expect(inScope('M2406#19', KICE_SCOPE)).toBe(true)
    expect(inScope('H2603G3#30', KICE_SCOPE)).toBe(false)
    expect(inScope('H2603G3#30', { set: 'hakpyeong', grade: 3 })).toBe(true)
    expect(inScope('H2603G1#30', { set: 'hakpyeong', grade: 3 })).toBe(false)
    expect(inScope('2026#31', { set: 'hakpyeong', grade: 3 })).toBe(false)
  })
})
