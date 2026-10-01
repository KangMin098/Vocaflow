// apps/web/src/lib/csat/__tests__/evidence-scope.test.ts
//
// 근거 매트릭스의 집합 범위 — 평가원(기본) · 학평 학년 하나. 범위는 URL 로만 옮기므로
// 파싱과 링크 조합이 서로 되돌아와야 한다(링크를 눌렀는데 평가원으로 떨어지면 조용히 틀린 화면이다).

import { describe, expect, it } from 'vitest'

import { parseEvidenceScope, scopeLabel, scopeQuery } from '../evidence-fold'
import { operationsHref, parseOperationsState } from '../evidence-operations'

describe('parseEvidenceScope', () => {
  it('기본은 평가원', () => {
    expect(parseEvidenceScope({})).toEqual({ set: 'kice' })
    expect(parseEvidenceScope({ set: 'nope', grade: '2' })).toEqual({ set: 'kice' })
  })
  it('학평은 학년 하나 — 모르는 학년은 고3', () => {
    expect(parseEvidenceScope({ set: 'hakpyeong', grade: '1' })).toEqual({ set: 'hakpyeong', grade: 1 })
    expect(parseEvidenceScope(new URLSearchParams('set=hakpyeong&grade=9'))).toEqual({ set: 'hakpyeong', grade: 3 })
  })
  it('이름과 질의 조각', () => {
    expect(scopeLabel({ set: 'kice' })).toBe('평가원')
    expect(scopeLabel({ set: 'hakpyeong', grade: 2 })).toBe('학평 고2')
    expect(scopeQuery({ set: 'kice' })).toBe('')
  })
})

describe('operationsHref 는 범위를 잃지 않는다', () => {
  it('학평 범위로 만든 링크를 다시 읽으면 같은 범위다', () => {
    const state = { ...parseOperationsState({}), scope: { set: 'hakpyeong', grade: 1 } as const, view: 'questions' as const }
    const href = operationsHref(state)
    expect(href).toContain('set=hakpyeong&grade=1')
    expect(parseOperationsState(new URLSearchParams(href.split('?')[1])).scope).toEqual({ set: 'hakpyeong', grade: 1 })
  })
  it('평가원 링크에는 범위를 싣지 않는다(옛 링크와 같은 모양)', () => {
    expect(operationsHref(parseOperationsState({}))).not.toContain('set=')
  })
})
