// packages/library-pipeline/src/compose/benchmark.test.ts
//
// 외부 기준선 — 목표를 반증 가능하게 유지한다.

import { describe, expect, it } from 'vitest'

import { BENCHMARK_SAMPLES, benchmarkBar, compareToBenchmark } from './benchmark'
import { BAND_CONSTRAINT } from './spine'

describe('기준선 표본', () => {
  it('표본마다 출처 주소가 있다 — 다시 재서 확인할 수 있어야 한다', () => {
    for (const s of BENCHMARK_SAMPLES) {
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.words).toBeGreaterThan(0)
      expect(s.aboveShare).toBeGreaterThanOrEqual(0)
      expect(s.aboveShare).toBeLessThan(1)
    }
  })

  it('본문은 보관하지 않는다 — 숫자와 주소만 남는다', () => {
    // 남의 본문을 저장하면 재저작 파이프라인의 비보관 규율과 어긋난다.
    for (const s of BENCHMARK_SAMPLES) {
      expect(Object.keys(s).sort()).toEqual([
        'aboveShare',
        'avgSentenceWords',
        'band',
        'level',
        'platform',
        'sentences',
        'slug',
        'url',
        'words',
      ])
    }
  })

  it('초등 허용치는 기준선 표본의 최대와 어긋나지 않는다', () => {
    // 허용치가 표본 최대보다 헐거우면, 기준선을 넘는 글이 게이트를 통과한다.
    const bar = benchmarkBar('elementary')!
    expect(bar.n).toBeGreaterThanOrEqual(5)
    expect(BAND_CONSTRAINT.elementary.value).toBeGreaterThanOrEqual(bar.maxAboveShare)
    expect(BAND_CONSTRAINT.elementary.value - bar.maxAboveShare).toBeLessThan(0.03)
  })
})

describe('견주기', () => {
  it('중앙값 이하면 낫다고, 범위 안이면 대등하다고, 넘으면 미달이라고 말한다', () => {
    const bar = benchmarkBar('elementary')!
    expect(compareToBenchmark('elementary', bar.medianAboveShare - 0.01).verdict).toBe('above')
    expect(compareToBenchmark('elementary', bar.medianAboveShare).verdict).toBe('above')
    expect(compareToBenchmark('elementary', bar.maxAboveShare).verdict).toBe('par')
    expect(compareToBenchmark('elementary', bar.maxAboveShare + 0.01).verdict).toBe('below')
  })

  it('표본이 없는 밴드는 판정하지 않는다 — 없는 기준으로 합격시키지 않는다', () => {
    const r = compareToBenchmark('middle', 0.001)
    expect(r.verdict).toBe('no-baseline')
    expect(r.detail).toContain('표본이 없어')
  })

  it("'낫다' 는 표본 중앙값 대비라고 스스로 밝힌다", () => {
    // n=5, 한 플랫폼이다. 이 함수가 말할 수 있는 것은 딱 그만큼이라고 적혀 있어야 한다.
    const d = compareToBenchmark('elementary', 0.01).detail
    expect(d).toContain('중앙')
    expect(d).toContain('n=')
  })
})
