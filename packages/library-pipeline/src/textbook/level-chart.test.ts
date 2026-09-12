// packages/library-pipeline/src/textbook/level-chart.test.ts
//
// 레벨 차트가 지키는 것:
//   ① **지문 없는 계단을 0어로 그리지 않는다** — 안 쓰는 것과 짧은 것은 다르다.
//   ② **빌려 온 규격을 밝힌다** — 표본이 얇은 버킷을 조용히 쓰면 근거가 사라진다.
//   ③ **축이 모든 행에 공통** — 행마다 다른 자를 쓰면 계단이 비교되지 않는다.
//   ④ **학년 찾기는 추측하지 않는다** — 부분 일치로 '중1' 이 '고1' 에 걸리면 안 된다.

import { describe, expect, it } from 'vitest'

import {
  V_TO_MARKET_BUCKET,
  buildLevelChart,
  findStepForBand,
  type LevelChartVolume,
} from './level-chart'

function vol(over: Partial<LevelChartVolume>): LevelChartVolume {
  return {
    step: 1,
    title: '제목',
    schoolBand: '고1',
    vLevels: [5],
    itemCount: 100,
    status: 'ready',
    ...over,
  }
}

describe('buildLevelChart', () => {
  it('시장 규격을 붙인다 — 고1 은 고1 버킷', () => {
    const [row] = buildLevelChart([vol({ vLevels: [5] })]).rows
    expect(row.bucket).toBe('고1')
    expect(row.words).not.toBeNull()
    expect(row.words!.p10).toBeLessThan(row.words!.median)
    expect(row.words!.median).toBeLessThan(row.words!.p90)
  })

  it('V레벨이 여럿이면 **가장 낮은 레벨**로 버킷을 잡는다 — 진입하는 자리가 거기다', () => {
    const [row] = buildLevelChart([vol({ vLevels: [7, 5] })]).rows
    expect(row.bucket).toBe(V_TO_MARKET_BUCKET[5])
  })

  it('빌려 온 규격을 밝힌다', () => {
    const [row] = buildLevelChart([vol({ vLevels: [1] })]).rows
    expect(row.bucket).toBe('초6')
    expect(row.borrowedFrom).toBeTruthy()
  })

  it('규격이 없는 V레벨은 words 가 null 이다 — 0 으로 적지 않는다', () => {
    const [row] = buildLevelChart([vol({ vLevels: [99] })]).rows
    expect(row.bucket).toBeNull()
    expect(row.words).toBeNull()
  })

  it('축은 모든 행에 공통이고, 규격 없는 행이 축을 망가뜨리지 않는다', () => {
    const chart = buildLevelChart([
      vol({ step: 1, vLevels: [5] }),
      vol({ step: 2, vLevels: [99] }),
    ])
    expect(chart.scale.min).toBe(0)
    const drawn = chart.rows.filter((r) => r.words)
    expect(chart.scale.max).toBe(Math.max(...drawn.map((r) => r.words!.p90)))
  })

  it('행이 하나도 규격을 못 찾아도 축이 0 폭이 되지 않는다 — 0 나누기 방지', () => {
    const chart = buildLevelChart([vol({ vLevels: [99] })])
    expect(chart.scale.max).toBeGreaterThan(chart.scale.min)
  })

  it('빈 입력에도 죽지 않는다', () => {
    const chart = buildLevelChart([])
    expect(chart.rows).toEqual([])
    expect(chart.scale.max).toBeGreaterThan(0)
  })

  it('근거(교재 종수·쪽수)를 함께 돌려준다 — 차트만 있고 출처가 없으면 그림과 같다', () => {
    const chart = buildLevelChart([vol({})])
    expect(chart.provenance.documentsMeasured).toBeGreaterThan(0)
    expect(chart.provenance.pagesMeasured).toBeGreaterThan(0)
  })

  it('ready 가 아닌 권도 행으로 남는다 — 사다리가 끊긴 자리를 숨기지 않는다', () => {
    const [row] = buildLevelChart([vol({ status: 'empty' })]).rows
    expect(row.ready).toBe(false)
  })
})

describe('findStepForBand', () => {
  const vols = [
    vol({ step: 3, schoolBand: '중학 1-2학년' }),
    vol({ step: 5, schoolBand: '고1' }),
  ]

  it('정확히 같은 학령만 고른다', () => {
    expect(findStepForBand(vols, '고1')?.step).toBe(5)
  })

  it('부분 일치로 엉뚱한 계단을 집지 않는다', () => {
    // '1' 은 '중학 1-2학년' 과 '고1' 둘 다에 들어 있다 — 부분 일치였다면 아무거나 집었을 것이다.
    expect(findStepForBand(vols, '1')).toBeNull()
  })

  it('없는 학령이면 null — 아무 권이나 돌려주지 않는다', () => {
    expect(findStepForBand(vols, '중3')).toBeNull()
  })
})
