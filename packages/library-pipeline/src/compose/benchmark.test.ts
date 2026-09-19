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

  it('허용치가 기준선보다 헐거워지지 않는다 — 헐거우면 미달 글이 통과한다', () => {
    for (const band of ['elementary', 'middle', 'high'] as const) {
      const bar = benchmarkBar(band)
      if (!bar) continue
      const c = BAND_CONSTRAINT[band]
      if (c.kind !== 'ceiling') continue
      // 표본 최대는 넘겨 주되(그 정도는 글로벌 수준이므로), 그 이상 헐거우면 안 된다.
      expect(c.value, band).toBeGreaterThanOrEqual(bar.maxAboveShare)
      expect(c.value - bar.maxAboveShare, band).toBeLessThan(0.02)
    }
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
    const r = compareToBenchmark('exam', 0.001)
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
