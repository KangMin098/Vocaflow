// apps/web/src/lib/textbook/__tests__/my-shelf.test.ts
//
// 내 교재의 순수 규칙.
//
// 여기서 지키는 것:
//   ① **없는 권을 그리지 않는다** — 시리즈가 줄면 담아 둔 step 이 남는다.
//   ② **순서는 계단 순** — 이 서가에서 순서는 곧 난이도다.
//   ③ **빈 제안을 팔지 않는다** — 마지막 권까지 담았으면 '다음 계단' 은 없다.
//   ④ **매대에 약속만 올리지 않는다** — 지금 펼칠 수 있는 권을 먼저 진열한다.

import { describe, expect, it } from 'vitest'

import { nextRung, pickedTotals, pickedVolumes, previewVolumes } from '../my-shelf'
import type { Shelf, ShelfVolume } from '../shelf'

function vol(step: number, over: Partial<ShelfVolume> = {}): ShelfVolume {
  return {
    step,
    title: `권 ${step}`,
    schoolBand: '중1',
    vLevels: [3],
    types: ['vocab_choice'],
    rationale: '',
    itemCount: 100 * step,
    byType: {},
    emptyTypes: [],
    status: 'ready',
    maxUnits: 10 * step,
    bySource: {},
    ...over,
  }
}

const SHELF: Shelf = {
  brand: 'Vocaflow',
  volumes: [vol(1), vol(2), vol(3), vol(4)],
  readyCount: 4,
  hasUnmeasured: false,
}

describe('담은 권', () => {
  it('서가에 없는 step 은 조용히 뺀다 (제목 없는 교재를 팔지 않는다)', () => {
    expect(pickedVolumes(SHELF, [2, 99]).map((v) => v.step)).toEqual([2])
  })

  it('넘긴 순서와 무관하게 계단 순으로 돌려준다', () => {
    expect(pickedVolumes(SHELF, [4, 1, 3]).map((v) => v.step)).toEqual([1, 3, 4])
  })

  it('합계는 담은 권만 센다', () => {
    const t = pickedTotals(pickedVolumes(SHELF, [1, 2]))
    expect(t).toEqual({ volumes: 2, items: 300, maxUnits: 30 })
  })
})

describe('다음 계단', () => {
  it('가장 높은 권 다음의, 아직 안 담은 권', () => {
    expect(nextRung(SHELF, [1, 2])!.step).toBe(3)
  })

  it('중간을 건너뛰고 담았어도 **가장 높은 권** 기준이다', () => {
    // [1, 3] 이면 2 가 비어 있지만, 다음 행동은 뒤로 가는 것이 아니라 위로 가는 것이다.
    expect(nextRung(SHELF, [1, 3])!.step).toBe(4)
  })

  it('마지막 권까지 담았으면 없다', () => {
    expect(nextRung(SHELF, [1, 2, 3, 4])).toBeNull()
  })

  it('하나도 안 담았으면 없다 — 그때는 매대가 그 자리를 대신한다', () => {
    expect(nextRung(SHELF, [])).toBeNull()
  })
})

describe('매대 (0권일 때 대신 진열할 권)', () => {
  it('이미 담은 권은 매대에 올리지 않는다', () => {
    expect(previewVolumes(SHELF, [1, 2]).map((v) => v.step)).toEqual([3, 4])
  })

  it('지금 펼칠 수 있는 권을 먼저 고른다 (약속만 파는 매대 금지)', () => {
    const mixed: Shelf = {
      ...SHELF,
      volumes: [
        vol(1, { status: 'empty' }),
        vol(2, { status: 'building' }),
        vol(3, { status: 'ready' }),
        vol(4, { status: 'ready' }),
      ],
    }
    // ready 인 3·4 가 먼저 뽑히고, 남은 한 칸을 앞 계단이 채운다.
    const shown = previewVolumes(mixed, [], 3).map((v) => v.step)
    expect(shown).toContain(3)
    expect(shown).toContain(4)
    expect(shown).toHaveLength(3)
  })

  it('뽑고 나서도 진열 순서는 계단 순이다', () => {
    const mixed: Shelf = {
      ...SHELF,
      volumes: [vol(1, { status: 'empty' }), vol(2, { status: 'ready' }), vol(3, { status: 'ready' })],
    }
    expect(previewVolumes(mixed, [], 3).map((v) => v.step)).toEqual([1, 2, 3])
  })

  it('서가가 비면 매대도 빈다 (없는 것을 지어내지 않는다)', () => {
    const empty: Shelf = { brand: 'V', volumes: [], readyCount: 0, hasUnmeasured: false }
    expect(previewVolumes(empty, [])).toEqual([])
  })
})
