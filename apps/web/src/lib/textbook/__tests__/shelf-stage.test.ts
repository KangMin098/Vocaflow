// apps/web/src/lib/textbook/__tests__/shelf-stage.test.ts
//
// 매대 분류 — 초등 / 중등 / 고등.
//
// 여기서 지키는 것 중 가장 중요한 하나: **사다리에 계단을 더하면 이 테스트가 실패한다.**
// `schoolBand` 접두사로 유추하지 않고 표로 적는 이유가 그것이다 — 유추하면 라벨이 바뀌는 날
// 권이 조용히 엉뚱한 매대에 꽂힌다. 사라지지 않으므로 아무도 모른다.

import { SERIES_SPINE } from '@vocaflow/library-pipeline'
import { describe, expect, it } from 'vitest'

import { buildShelf } from '../shelf'
import { STAGE_ORDER, groupByStage, stageOf } from '../shelf-stage'
import type { ShelfVolume } from '../shelf'

function vol(step: number, schoolBand: string): ShelfVolume {
  return {
    step,
    title: `권 ${step}`,
    schoolBand,
    vLevels: [step],
    types: [],
    rationale: '',
    itemCount: 0,
    byType: {},
    emptyTypes: [],
    status: 'empty',
    maxUnits: 0,
  }
}

describe('사다리와 매대표가 어긋나지 않는다', () => {
  it('SERIES_SPINE 의 모든 학령 밴드가 매대에 배정된다', () => {
    const unmapped = SERIES_SPINE.filter((r) => stageOf(r.schoolBand) === null).map(
      (r) => `step ${r.step} "${r.schoolBand}"`,
    )
    expect(
      unmapped,
      `매대 표(shelf-stage.BAND_STAGE)에 없는 학령: ${unmapped.join(', ')}`,
    ).toEqual([])
  })

  it('실제 서가가 세 매대로 갈린다 (평평한 일곱 줄이 아니다)', () => {
    const groups = groupByStage(buildShelf([], true).volumes)
    expect(groups.map((g) => g.label)).toEqual(['초등', '중등', '고등'])
    expect(groups.reduce((s, g) => s + g.volumes.length, 0)).toBe(SERIES_SPINE.length)
  })
})

describe('진열 규칙', () => {
  it('매대 순서는 난이도 순이다 (가나다 정렬이면 고등이 맨 앞에 온다)', () => {
    const groups = groupByStage([vol(7, '고3 / 수능 상위'), vol(1, '초등 저학년'), vol(3, '중학 1-2학년')])
    expect(groups.map((g) => g.label)).toEqual(['초등', '중등', '고등'])
    expect(STAGE_ORDER[0]).toBe('elementary')
  })

  it('빈 매대는 내지 않는다 — 없는 칸에 팻말을 세우지 않는다', () => {
    const groups = groupByStage([vol(1, '초등 저학년')])
    expect(groups.map((g) => g.label)).toEqual(['초등'])
  })

  it('매대 안의 권 순서는 넘긴 순서를 지킨다 (필터가 이미 계단 순으로 준다)', () => {
    const groups = groupByStage([vol(1, '초등 저학년'), vol(2, '초등 고학년')])
    expect(groups[0].volumes.map((v) => v.step)).toEqual([1, 2])
  })

  it('표에 없는 학령은 **버리지 않고** 자기 이름으로 모인다', () => {
    // 사다리에 새 계단이 생겼는데 매핑을 안 적었을 때, 권이 화면에서 사라지는 것이 가장 나쁘다.
    const groups = groupByStage([vol(1, '초등 저학년'), vol(9, '대학 교양'), vol(10, '대학 교양')])
    expect(groups.map((g) => g.label)).toEqual(['초등', '대학 교양'])
    expect(groups[1].volumes.map((v) => v.step)).toEqual([9, 10])
    expect(groups[1].stage).toBeNull()
  })

  it('빈 목록은 빈 묶음이다', () => {
    expect(groupByStage([])).toEqual([])
  })
})
