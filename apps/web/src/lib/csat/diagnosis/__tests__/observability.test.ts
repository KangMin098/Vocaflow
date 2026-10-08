// apps/web/src/lib/csat/diagnosis/__tests__/observability.test.ts
//
// 진단축 관측가능성 · 식별성 회귀(2026-10-08) — 연결 0(absent) · 완전 관측 · 완전 혼동(같은 열) · 포함(nested) ·
// 부분 독립 · 누적 시험 · 거짓 1위 재분류(F1/F2/F3).
import { describe, expect, it } from 'vitest'

import type { AttributeCode } from '../engine/types'
import { axisObservability, classifyFalseTop, matrixRank, pairObs, rSquared, stackExams, type ObsItem } from '../observability'

const item = (no: number, ...codes: AttributeCode[]): ObsItem => ({ no, weights: Object.fromEntries(codes.map((c) => [c, 1])) })
const many = (from: number, n: number, ...codes: AttributeCode[]) => Array.from({ length: n }, (_, i) => item(from + i, ...codes))

describe('축 상태', () => {
  it('연결 0 → absent', () => {
    const o = axisObservability([...many(1, 10, 'A1'), ...many(20, 10, 'A3')])
    expect(o.S.status).toBe('absent')
    expect(o.X.status).toBe('absent')
  })
  it('최소 관측 미달 → insufficient(독립이어도)', () => {
    const o = axisObservability([...many(1, 10, 'A1'), ...many(20, 3, 'A2'), ...many(30, 10, 'A3')])
    expect(o.S).toMatchObject({ tagged: 3, observableByCount: false, status: 'insufficient' })
  })
  it('완전 관측 — 단독 문항이 충분하고 다른 축과 독립', () => {
    const o = axisObservability([...many(1, 8, 'A1'), ...many(20, 8, 'A3'), ...many(40, 8, 'A4')])
    expect(o.V).toMatchObject({ status: 'observable', unique: 8 })
    expect(o.V.independence as number).toBeGreaterThan(0.5)
  })
  it('완전 혼동 — S 가 붙은 문항마다 V 도 붙고 V 단독은 없다(같은 열) → 둘 다 confounded · identical', () => {
    const items = [...many(1, 8, 'A1', 'A2'), ...many(20, 8, 'A3')]
    const o = axisObservability(items)
    expect(pairObs(items, 'V', 'S').relation).toBe('identical')
    expect(o.S.status).toBe('confounded')
    expect(o.V.status).toBe('confounded')
    expect(o.S.independence).toBeCloseTo(0, 6)
  })
  it('단독 문항 0 — 모든 V 문항이 R · E 와 함께 붙으면(포함은 아니어도) confounded(M2409 · 평가원 29회의 V 꼴)', () => {
    const items = [...many(1, 5, 'A1', 'A3'), ...many(10, 5, 'A1', 'A4'), ...many(20, 6, 'A3'), ...many(40, 6, 'A4')]
    const o = axisObservability(items)
    expect(o.V).toMatchObject({ unique: 0, status: 'confounded', nestedIn: [] })
    expect(o.R.status).toBe('observable')
  })
  it('포함(nested) — S ⊂ V(V 단독 많음) → S 는 confounded, V 는 아니다', () => {
    const items = [...many(1, 6, 'A1', 'A2'), ...many(20, 10, 'A1'), ...many(40, 10, 'A3')]
    const o = axisObservability(items)
    expect(pairObs(items, 'S', 'V').relation).toBe('a_in_b')
    expect(o.S).toMatchObject({ status: 'confounded', nestedIn: ['V'] })
    expect(o.V.status).toBe('observable')
  })
  it('부분 독립 — 겹치지만 각자 단독 문항이 있으면 observable', () => {
    const items = [...many(1, 4, 'A1', 'A2'), ...many(10, 5, 'A2'), ...many(20, 8, 'A1'), ...many(40, 8, 'A3')]
    const o = axisObservability(items)
    expect(pairObs(items, 'V', 'S').relation).toBe('overlap')
    expect(o.S.status).toBe('observable')
  })
})

describe('행렬 · 회귀 도구', () => {
  it('rank — 같은 열 · 영 열은 rank 를 늘리지 않는다', () => {
    expect(matrixRank([[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 0, 0]])).toBe(2)
  })
  it('R²₀(절편 없음) — 같은 열 1 · 겹침 없음 0 · 영 열 null', () => {
    expect(rSquared([1, 0, 1, 0], [[1, 0, 1, 0]])).toBeCloseTo(1, 6)
    expect(rSquared([1, 1, 0, 0], [[0, 0, 1, 1]])).toBeCloseTo(0, 6)
    expect(rSquared([0, 0, 0], [[0, 1, 0]])).toBeNull()
  })
  it('축이 문항을 나눠 가져도(합 = 절편) 독립으로 본다 — 절편 인공물 회귀', () => {
    const o = axisObservability([...many(1, 8, 'A1'), ...many(20, 8, 'A3'), ...many(40, 8, 'A4'), ...many(60, 8, 'A2')])
    for (const a of ['V', 'S', 'R', 'E'] as const) expect(o[a].independence).toBeCloseTo(1, 6)
  })
})

describe('누적 시험', () => {
  it('관측 수는 늘어 insufficient 가 풀리지만, 포함 관계(구조)는 그대로', () => {
    const exam = [...many(1, 3, 'A2'), ...many(10, 8, 'A1'), ...many(30, 8, 'A3')]
    expect(axisObservability(exam).S.status).toBe('insufficient')
    expect(axisObservability(stackExams([exam, exam])).S.status).toBe('observable')
    const nested = [...many(1, 3, 'A1', 'A2'), ...many(10, 8, 'A1'), ...many(30, 8, 'A3')]
    expect(axisObservability(stackExams([nested, nested, nested])).S.status).toBe('confounded')
  })
})

describe('거짓 1위 재분류', () => {
  const exam = [...many(1, 1, 'A2'), ...many(10, 10, 'A1'), ...many(30, 10, 'A3'), ...many(50, 4, 'A1', 'A6')]
  it('약한 역량이 관측 불가(A2 1 · A6 4) → F2', () => {
    expect(classifyFalseTop(exam, ['A2'], 'V')).toBe('F2_unobservable')
    expect(classifyFalseTop(exam, ['A6'], 'V')).toBe('F2_unobservable')
  })
  it('약한 역량이 관측 가능하고 고른 축과 독립 → F1(순위 오류 후보)', () => {
    expect(classifyFalseTop(exam, ['A3'], 'V')).toBe('F1_identifiable')
    expect(classifyFalseTop(exam, ['A2', 'A3'], 'V')).toBe('F1_identifiable')
  })
  it('고른 1위 축에 단독 문항이 없고 약한 축과 문항을 나눠 쓰면 → F3(V 근거가 전부 R 과 함께 붙은 꼴)', () => {
    const shared = [...many(1, 8, 'A1', 'A3'), ...many(20, 8, 'A3'), ...many(40, 8, 'A4')]
    expect(axisObservability(shared).V.unique).toBe(0)
    expect(classifyFalseTop(shared, ['A3'], 'V')).toBe('F3_confounded')
    expect(classifyFalseTop(shared, ['A4'], 'V')).toBe('F1_identifiable') // E 는 V 와 문항을 나눠 쓰지 않는다
  })
  it('관측은 되지만 고른 축에 포함 → F3', () => {
    const conf = [...many(1, 6, 'A1', 'A2'), ...many(10, 10, 'A1'), ...many(30, 10, 'A3')]
    expect(classifyFalseTop(conf, ['A2'], 'V')).toBe('F3_confounded')
  })
})
