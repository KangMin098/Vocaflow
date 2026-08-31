// packages/library-pipeline/src/textbook/publisher-index.test.ts
import { describe, expect, it } from 'vitest'
import {
  axisCeiling,
  bindingPublisher,
  canScoreTypeSpread,
  geoMean,
  reachableMax,
  wilson95,
  type PublisherAxis,
} from './publisher-index'

const axis = (o: Partial<PublisherAxis>): PublisherAxis => ({
  id: 'A6', unit: '%', ours: 0.87, market: 0.8, index: 1.09, ...o,
})

describe('wilson95', () => {
  it('구간이 항상 [0,1] 안에 있다 — 전량 적중해도 상한이 1 을 넘지 않는다', () => {
    const w = wilson95(10, 10)!
    expect(w.point).toBe(1)
    expect(w.hi).toBeLessThanOrEqual(1)
    expect(w.lo).toBeGreaterThan(0)
  })

  it('0건 적중에서도 하한이 음수가 되지 않는다 (Wald 였다면 음수다)', () => {
    const w = wilson95(0, 20)!
    expect(w.lo).toBe(0)
    expect(w.hi).toBeGreaterThan(0)
  })

  it('표본이 작을수록 구간이 넓다 — 그래서 문턱 없이도 작은 표본이 과대주장을 막는다', () => {
    const small = wilson95(5, 10)!
    const big = wilson95(500, 1000)!
    expect(small.hi - small.lo).toBeGreaterThan(big.hi - big.lo)
  })

  it('표본이 0 이거나 분자가 분모보다 크면 잴 수 없다 (null)', () => {
    expect(wilson95(0, 0)).toBeNull()
    expect(wilson95(5, 3)).toBeNull()
  })

  it('알려진 값과 맞는다 — p=0.5, n=100 의 95% 구간은 대략 0.404~0.596', () => {
    const w = wilson95(50, 100)!
    expect(w.lo).toBeCloseTo(0.404, 2)
    expect(w.hi).toBeCloseTo(0.596, 2)
  })
})

describe('geoMean', () => {
  it('산술평균이 아니라 기하평균이다 — 비율의 평균은 기하평균이다', () => {
    // 산술평균이면 2.5 다. 기하평균은 2 다.
    expect(geoMean([1, 4])).toBe(2)
  })

  it('한 축이 0 에 가까우면 종합이 끌려 내려간다', () => {
    expect(geoMean([2, 2, 0.01])!).toBeLessThan(1)
  })

  it('**못 잰 축(null)은 0 점이 아니라 제외다** — 없는 패배를 적지 않는다', () => {
    expect(geoMean([1.2, null, 1.2])).toBe(1.2)
  })

  it('잴 수 있는 축이 하나도 없으면 null 이다 (0 이 아니다)', () => {
    expect(geoMean([null, null])).toBeNull()
    expect(geoMean([])).toBeNull()
  })
})

describe('axisCeiling', () => {
  it('비율 축의 천장은 1/시장 이다 — 우리 값이 100% 를 못 넘기 때문', () => {
    expect(axisCeiling(axis({ market: 0.8 }))).toBe(1.25)
  })

  it('시장이 100% 인 축은 천장이 1.000 — 120% 가 산술적으로 불가능하다', () => {
    expect(axisCeiling(axis({ id: 'A1', market: 1 }))).toBe(1)
  })

  it('개수 축에는 천장이 없다', () => {
    expect(axisCeiling(axis({ id: 'A5', unit: '종', market: 14 }))).toBeNull()
  })
})

describe('reachableMax', () => {
  it('EBS 실측 재현 — A6·A7 두 축만 잴 때 최대치가 1.199 라 1.200 이 불가능하다', () => {
    const axes = [
      axis({ id: 'A6', market: 0.8, index: 1.092 }),
      axis({ id: 'A7', market: 0.869, index: 1.151 }),
    ]
    const max = reachableMax(axes)!
    expect(max).toBeCloseTo(1.199, 3)
    expect(max).toBeLessThan(1.2)
  })

  it('못 잰 축은 천장 계산에서도 빠진다 — 못 재는데 천장이 있다고 세지 않는다', () => {
    const axes = [
      axis({ id: 'A6', market: 0.8, index: 1.09 }),
      axis({ id: 'A2', market: 0.65, index: null, insufficient: '해설 문서 0건' }),
    ]
    expect(reachableMax(axes)).toBe(1.25)
  })
})

describe('bindingPublisher', () => {
  it('가장 낮은 곳이 실제 성적이다 — 평균이 아니다', () => {
    const rows = [
      { publisher: 'NE능률', overallIndex: 1.36 },
      { publisher: 'EBS', overallIndex: 1.121 },
      { publisher: '쎄듀', overallIndex: 1.122 },
    ]
    expect(bindingPublisher(rows)!.publisher).toBe('EBS')
  })

  it('못 잰 출판사는 후보가 아니다 — 이겼다고도 졌다고도 적지 않는다', () => {
    const rows = [
      { publisher: 'NE능률', overallIndex: 1.36 },
      { publisher: '수경출판사', overallIndex: null },
    ]
    expect(bindingPublisher(rows)!.publisher).toBe('NE능률')
  })

  it('잴 수 있는 곳이 하나도 없으면 null 이다', () => {
    expect(bindingPublisher([{ publisher: '수경출판사', overallIndex: null }])).toBeNull()
  })
})

describe('canScoreTypeSpread', () => {
  it('창고 모드(79종 합본 분모)에서는 출판사별로 잴 수 없다 — 표본이 작을수록 우리가 유리해진다', () => {
    expect(canScoreTypeSpread('79종 합본')).toBe(false)
  })

  it('권 대 권(perDocument 중앙값)일 때만 잰다', () => {
    expect(canScoreTypeSpread('권당 중앙값 (고등 15종 실측)')).toBe(true)
  })

  it('근거가 없으면 재지 않는다', () => {
    expect(canScoreTypeSpread(null)).toBe(false)
    expect(canScoreTypeSpread(undefined)).toBe(false)
  })
})
