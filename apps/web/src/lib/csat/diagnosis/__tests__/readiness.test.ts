// apps/web/src/lib/csat/diagnosis/__tests__/readiness.test.ts
//
// 진단 반영 판정 회귀(2026-10-07) — 문항 검수 = 역량 9개가 모두 검수된 행. 0(해당 없음)도 검수된 판정이고,
// 「행 없음」 · 시드(type_default · 미검수)는 해당 없음이 아니라 미검수다. A1 특례 없음 — 어떤 역량이든 같은 규칙.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ATTRIBUTE_CODES } from '../engine/types'
import { examReadiness, itemReview, type ReadinessItem } from '../readiness'

/** 검수 저장(RPC)이 쓰는 모양 — 9개 전부, 0 포함, 검수 표지 */
const reviewedItem = (id: string): ReadinessItem => ({ id, hasAnswer: true, attrs: ATTRIBUTE_CODES.map((code) => ({ code, reviewed: true })) })
/** 유형 기본값 시드 모양 — 0 이 아닌 역량만, 검수 표지 없음(M2409 실측: A1 은 28문항 중 11문항에만) */
const seededItem = (id: string, codes: string[]): ReadinessItem => ({ id, hasAnswer: true, attrs: codes.map((code) => ({ code, reviewed: false })) })

describe('문항 검수', () => {
  it('9개 역량이 모두 검수된 행이면 reviewed — 대부분이 0(해당 없음)이어도', () => {
    expect(itemReview(reviewedItem('x'))).toBe('reviewed')
  })
  it('시드만 있는 문항은 unreviewed — 행이 없는 역량을 「해당 없음」으로 세지 않는다', () => {
    expect(itemReview(seededItem('x', ['A3', 'A5']))).toBe('unreviewed')
    expect(itemReview({ attrs: [] })).toBe('unreviewed')
  })
  it('9개 중 하나라도 미검수면 unreviewed — 어떤 역량이든(A1 특례 없음)', () => {
    for (const miss of ATTRIBUTE_CODES) {
      const it = reviewedItem('x')
      const attrs = it.attrs.map((a) => (a.code === miss ? { ...a, reviewed: false } : a))
      expect(itemReview({ ...it, attrs })).toBe('unreviewed')
      expect(itemReview({ ...it, attrs: it.attrs.filter((a) => a.code !== miss) })).toBe('unreviewed')
    }
  })
})

describe('시험 진단 반영', () => {
  const exam = (n: number, f: (i: number) => ReadinessItem) => Array.from({ length: n }, (_, i) => f(i))
  it('정상 — 모든 문항 검수 · 정답표 45 · 정답 있음 → 켤 수 있다', () => {
    const r = examReadiness(45, exam(28, (i) => reviewedItem(`i${i}`)))
    expect(r).toMatchObject({ required: 28, reviewed: 28, remaining: 0, structural: [], canEnable: true })
  })
  it('회귀(M2409 꼴) — 시드에서 A1 이 11/28 문항에만 있어도, 검수를 끝내면 켤 수 있다(A1 부재로 막히지 않는다)', () => {
    const before = examReadiness(45, exam(28, (i) => seededItem(`i${i}`, i < 11 ? ['A1', 'A3'] : ['A3', 'A4'])))
    expect(before).toMatchObject({ required: 28, reviewed: 0, remaining: 28, canEnable: false })
    expect(before.reason).toMatch(/검수 완료 후 가능/)
    const after = examReadiness(45, exam(28, (i) => reviewedItem(`i${i}`)))
    expect(after.canEnable).toBe(true)
  })
  it('차단 — 문항 하나의 역량 하나라도 미검수면 켤 수 없다', () => {
    const items = exam(28, (i) => reviewedItem(`i${i}`))
    items[5] = { ...items[5], attrs: items[5].attrs.map((a) => (a.code === 'A6' ? { ...a, reviewed: false } : a)) }
    const r = examReadiness(45, items)
    expect(r).toMatchObject({ reviewed: 27, remaining: 1, canEnable: false })
  })
  it('차단 — 구조 문제(정답표 ≠ 45 · 문항 없음 · 정답 없는 문항)는 검수로 풀리지 않는다', () => {
    expect(examReadiness(44, exam(28, (i) => reviewedItem(`i${i}`)))).toMatchObject({ canEnable: false, structural: ['정답표 44/45'] })
    expect(examReadiness(45, [])).toMatchObject({ canEnable: false, structural: ['문항 없음'] })
    const noAns = exam(28, (i) => ({ ...reviewedItem(`i${i}`), hasAnswer: i !== 3 }))
    const r = examReadiness(45, noAns)
    expect(r.canEnable).toBe(false)
    expect(r.reason).toMatch(/진단 반영 불가 — 정답 없는 문항 1/)
  })
})

describe('판정은 한 곳 — 관리자 목록 · 켜기 액션', () => {
  it('켜기 액션은 readiness(loadReadiness)만 보고 A1 을 직접 세지 않는다', () => {
    const act = fs.readFileSync(path.resolve(__dirname, '../../../../app/admin/csat/diagnosis/actions.ts'), 'utf8')
    const admin = fs.readFileSync(path.resolve(__dirname, '../admin.ts'), 'utf8')
    expect(act).toContain('loadReadiness(c, [examId])')
    expect(act).not.toMatch(/eq\('attribute_code', 'A1'\)/)
    expect(admin).not.toMatch(/eq\('attribute_code', 'A1'\)/)
  })
})
