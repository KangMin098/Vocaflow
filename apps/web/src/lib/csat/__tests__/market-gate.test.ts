// apps/web/src/lib/csat/__tests__/market-gate.test.ts
//
// **② 기획 게이트 — 증거가 없는 출판사는 「모자람」이 아니라 「못 잼」이다.**
//
// 잠그는 것 셋:
//   ① 구조적으로 못 닿는 출판사(EBS · reachableMax 1.199)가 판정 구속점이 되지 않는다
//   ② 그래도 **판정 가능한 출판사의 진짜 미달은 가려지지 않는다** — 그게 이 규칙의 전제다
//   ③ 모르는 것(reachableMax 없음)을 「못 닿음」으로 빼지 않는다

import { describe, expect, it } from 'vitest'

import type { BenchFile, BenchPublisher } from '../factory-bench'
import { reportAgeDays, splitMarketGate } from '../market-gate'

const pub = (o: Partial<BenchPublisher>): BenchPublisher => ({
  publisher: 'X',
  docs: 1,
  pages: 1,
  overallIndex: 1.3,
  reachableMax: 1.4,
  targetReachable: true,
  axesMeasured: 7,
  axesTotal: 7,
  gaps: [],
  axes: [],
  ...o,
})

const bench = (publishers: BenchPublisher[]): BenchFile => ({
  generatedAt: '2026-09-01T07:33:23.059Z',
  scope: '',
  bindingPublisher: null,
  bindingIndex: null,
  pooledIndex: 1.4,
  publishers,
})

/** 2026-09-01 권 리포트의 실제 모양. */
const REAL = bench([
  pub({ publisher: 'NE능률', overallIndex: 1.343, reachableMax: 1.391, axesMeasured: 6 }),
  pub({
    publisher: 'EBS',
    overallIndex: 1.199,
    reachableMax: 1.199,
    targetReachable: false,
    axesMeasured: 2,
    gaps: ['해설 축 A1~A4', '유형 축 A5'],
  }),
  pub({ publisher: '쎄듀', overallIndex: 1.2, reachableMax: 1.2, axesMeasured: 2 }),
  pub({ publisher: '수경출판사', overallIndex: null, reachableMax: null, targetReachable: false, axesMeasured: 0 }),
])

describe('실제 리포트 모양', () => {
  const g = splitMarketGate(REAL, 1.2)

  it('EBS 는 판정 구속점이 아니라 증거 부족으로 간다', () => {
    expect(g.judged?.publisher).not.toBe('EBS')
    expect(g.unreachable.map((u) => u.publisher)).toEqual(['EBS'])
    expect(g.unreachable[0]!.reachableMax).toBe(1.199)
  })

  it('판정 가능한 구속점은 쎄듀 1.200 이다', () => {
    expect(g.judged).toEqual({ publisher: '쎄듀', index: 1.2 })
  })

  it('지수가 없는 출판사는 이름만 남는다 — 원래도 구속점 계산 밖이었다', () => {
    expect(g.unindexed).toEqual(['수경출판사'])
  })
})

describe('진짜 미달은 가려지지 않는다', () => {
  it('판정 가능한 출판사가 목표 미달이면 그 수가 구속점이다', () => {
    const g = splitMarketGate(
      bench([
        pub({ publisher: 'A', overallIndex: 1.15, reachableMax: 1.3 }),
        pub({ publisher: 'B', overallIndex: 1.1, reachableMax: 1.1, targetReachable: false }),
      ]),
      1.2,
    )
    // B 는 더 낮지만 못 닿는 쪽이라 빠지고, A 의 미달(1.15)이 그대로 구속점이 된다.
    expect(g.judged).toEqual({ publisher: 'A', index: 1.15 })
    expect(g.unreachable.map((u) => u.publisher)).toEqual(['B'])
  })

  it('모두 못 닿으면 판정 구속점이 없다 — 통과로 뭉개지 않는다', () => {
    const g = splitMarketGate(
      bench([pub({ publisher: 'A', overallIndex: 1.0, reachableMax: 1.1, targetReachable: false })]),
      1.2,
    )
    expect(g.judged).toBeNull()
  })
})

describe('모르는 것을 「못 닿음」으로 빼지 않는다', () => {
  it('reachableMax 가 없으면 targetReachable 을 보고, 그것도 없으면 닿을 수 있다고 본다', () => {
    const g = splitMarketGate(
      bench([pub({ publisher: 'A', overallIndex: 1.1, reachableMax: null, targetReachable: undefined as never })]),
      1.2,
    )
    expect(g.judged).toEqual({ publisher: 'A', index: 1.1 })
    expect(g.unreachable).toEqual([])
  })

  it('reachableMax 가 있으면 그것이 targetReachable 보다 우선한다', () => {
    const g = splitMarketGate(
      bench([pub({ publisher: 'A', overallIndex: 1.19, reachableMax: 1.19, targetReachable: true })]),
      1.2,
    )
    expect(g.unreachable.map((u) => u.publisher)).toEqual(['A'])
  })
})

describe('리포트 나이', () => {
  it('며칠 전인지 소수 첫째 자리로', () => {
    expect(reportAgeDays('2026-09-01T00:00:00Z', new Date('2026-09-17T12:00:00Z'))).toBe(16.5)
  })
  it('시각이 깨졌으면 null', () => {
    expect(reportAgeDays('')).toBeNull()
  })
})
