// apps/web/src/lib/csat/__tests__/plan-order.test.ts
//
// **⑤ 주파의 순서를 잠근다.**
//
// 이 순서가 틀리면 학습자는 **엉뚱한 유형부터 공부한다.** 그런데 화면은 멀쩡히 돌고 줄도
// 그럴듯하게 서 있다 — 틀린 순서와 맞는 순서는 눈으로 구별되지 않는다. 그래서 산술을 잰다.

import { describe, expect, it } from 'vitest'

import { TRAPS } from '../trap-atlas'
import { orderRows, riskByType } from '../plan-order'

const row = (no: number, type_id: string) => ({ no, type_id })

describe('riskByType — 내 약점 × 유형 구성', () => {
  it('기록이 없으면 아무 유형도 점수를 받지 않는다', () => {
    // 0 으로 줄을 세우면 순서가 아니라 잡음이다. 화면은 이때 정렬을 아예 안 내민다.
    expect(riskByType({}).size).toBe(0)
  })

  it('점수는 0~1 이다 — 두 몫을 곱해 더한 값이므로', () => {
    const r = riskByType({ '어휘 함정': 5, 무관: 3 })
    expect(r.size).toBeGreaterThan(0)
    for (const [, v] of r) {
      expect(v.score).toBeGreaterThanOrEqual(0)
      expect(v.score).toBeLessThanOrEqual(1)
    }
  })

  it('내가 걸리는 수법이 많이 든 유형이 더 높다', () => {
    // 「지시어 선행사 절단」은 4유형에만 나온다(그중 R-REFER·X-REFER 계열).
    // 그 수법만 놓치는 사람에게는 그 유형이 위로 와야 한다.
    const bound = TRAPS.find((t) => t.key === '지시어 선행사 절단')
    expect(bound, '이 검사는 그 함정이 지도에 있어야 성립한다').toBeTruthy()
    const [heavyType] = Object.entries(bound!.by_type).sort((a, b) => b[1] - a[1])[0]!

    const r = riskByType({ '지시어 선행사 절단': 10 })
    const heavy = r.get(heavyType)!.score
    // 그 수법이 아예 없는 유형은 0 이어야 한다.
    const noneType = TRAPS[0]!.by_type
    const zeroType = Object.keys(noneType).find((t) => !(bound!.by_type[t] ?? 0))
    expect(heavy).toBeGreaterThan(0)
    if (zeroType) expect(r.get(zeroType)?.score ?? 0).toBe(0)
  })

  it('driver 는 그 유형에서 가장 크게 기여한 수법이다', () => {
    const r = riskByType({ 무관: 10 })
    for (const [typeId, v] of r) {
      if (v.score <= 0) continue
      expect(`${typeId}:${v.driver}`).toBe(`${typeId}:무관`)
      expect(v.driverShare).toBeGreaterThan(0)
      expect(v.driverShare).toBeLessThanOrEqual(1)
    }
  })

  it('내 오답의 몫으로 정규화한다 — 절대 개수가 아니라', () => {
    // 10번 놓친 사람과 100번 놓친 사람의 **분포가 같으면** 순서도 같아야 한다.
    const a = riskByType({ 무관: 3, '어휘 함정': 1 })
    const b = riskByType({ 무관: 30, '어휘 함정': 10 })
    for (const [k, v] of a) expect(Math.abs(v.score - (b.get(k)?.score ?? 0))).toBeLessThan(1e-9)
  })
})

describe('orderRows', () => {
  const rows = [row(45, 'R-BLANK'), row(18, 'R-PURPOSE'), row(30, 'R-ORDER')]

  it('시험 순서는 번호 순서다', () => {
    expect(orderRows(rows, 'exam', new Map()).map((r) => r.no)).toEqual([18, 30, 45])
  })

  it('원본을 건드리지 않는다', () => {
    orderRows(rows, 'exam', new Map())
    expect(rows.map((r) => r.no)).toEqual([45, 18, 30])
  })

  it('약한 것 먼저는 위험도 내림차순', () => {
    const risk = new Map([
      ['R-BLANK', { score: 0.1, driver: null, driverShare: 0 }],
      ['R-PURPOSE', { score: 0.5, driver: null, driverShare: 0 }],
      ['R-ORDER', { score: 0.3, driver: null, driverShare: 0 }],
    ])
    expect(orderRows(rows, 'weak', risk).map((r) => r.no)).toEqual([18, 30, 45])
  })

  it('위험도가 같으면 번호 순서로 되돌아간다 — 새로고침마다 흔들리지 않게', () => {
    const flat = new Map(
      ['R-BLANK', 'R-PURPOSE', 'R-ORDER'].map((k) => [k, { score: 0.2, driver: null, driverShare: 0 }]),
    )
    expect(orderRows(rows, 'weak', flat).map((r) => r.no)).toEqual([18, 30, 45])
  })

  it('위험도를 모르는 유형은 0 으로 보고 뒤로 간다', () => {
    const risk = new Map([['R-ORDER', { score: 0.9, driver: null, driverShare: 0 }]])
    expect(orderRows(rows, 'weak', risk).map((r) => r.no)).toEqual([30, 18, 45])
  })

  it('줄 수가 변하지 않는다 — 정렬이 행을 잃으면 계획에 구멍이 난다', () => {
    const risk = riskByType({ 무관: 4, '범위 과대': 2 })
    expect(orderRows(rows, 'weak', risk)).toHaveLength(rows.length)
    expect(new Set(orderRows(rows, 'weak', risk).map((r) => r.no))).toEqual(new Set([18, 30, 45]))
  })
})
