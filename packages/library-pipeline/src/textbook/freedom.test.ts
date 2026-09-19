// packages/library-pipeline/src/textbook/freedom.test.ts
//
// **"못 쟀다" 를 "0" 으로 세지 않는다** — 이 파일이 지키는 것의 대부분이 그것이다.
//
// 자유도는 재고를 나눈 몫이라 산수 자체는 쉽다. 틀리는 자리는 늘 **빈 값의 처리**다:
// 못 잰 칸을 0 으로 세면 "낼 수 없다" 는 거짓 경보가 되고, 빼고 세면 "낼 수 있다" 는
// 더 나쁜 거짓이 된다. 둘 다 여기서 잠근다.
//
// 실측값(2026-09-15 DB)을 픽스처로 쓴다 — 산수가 맞는지가 아니라 **그 수에서 이 판정이
// 나오는지**를 봐야 하기 때문이다.

import { describe, expect, it } from 'vitest'

import {
  bandFreedom,
  freedomIndex,
  mixFreedom,
  soloFreedom,
  soloReport,
  type FreedomCell,
} from './freedom'

/** V7 실측 — 이해·추론형만 추렸다(2026-09-15 `csat_dcp_items`). */
const V7: FreedomCell[] = [
  { type: 'long_reference', items: 4, needPerVolume: 3 },
  { type: 'mood', items: 8, needPerVolume: 5 },
  { type: 'claim', items: 13, needPerVolume: 1 },
  { type: 'title', items: 36, needPerVolume: 9 },
  { type: 'topic', items: 50, needPerVolume: 8 },
  { type: 'blank', items: 71, needPerVolume: 17 },
]

describe('단일유형 특강 자유도', () => {
  it('30문항 특강 기준 — V7 이해형은 blank·topic·title 만 된다', () => {
    const r = soloReport(V7, 30)
    const ok = r.verdicts.filter((v) => v.ok).map((v) => v.type)
    expect(ok.sort()).toEqual(['blank', 'title', 'topic'])
    expect(r.ok).toBe(3)
    expect(r.measured).toBe(6)
  })

  it('겹치지 않는 권 수는 내림이다 — 71문항으로 30문항 특강 2권', () => {
    const v = soloFreedom([{ type: 'blank', items: 71 }], 30)[0]
    expect(v.volumes).toBe(2)
    expect(v.short).toBe(0)
  })

  it('모자란 만큼을 적는다 — 무엇을 몇 개 더 만들면 되는지가 곧 할 일이다', () => {
    const v = soloFreedom([{ type: 'mood', items: 8 }], 30)[0]
    expect(v.ok).toBe(false)
    expect(v.short).toBe(22)
    expect(v.volumes).toBe(0)
  })

  it('가장 모자란 칸이 먼저 온다', () => {
    const r = soloReport(V7, 30)
    expect(r.gaps.map((g) => g.type)).toEqual(['long_reference', 'mood', 'claim'])
  })

  it('크기가 0 이하면 던진다 — 조용히 무한대를 내지 않는다', () => {
    expect(() => soloFreedom(V7, 0)).toThrow()
    expect(() => soloFreedom(V7, -5)).toThrow()
  })
})

describe('못 쟀다 ≠ 0', () => {
  it('단일유형: 못 잰 칸은 ok 도 volumes 도 null 이고 분모에서 빠진다', () => {
    const r = soloReport(
      [
        { type: 'blank', items: 71 },
        { type: 'mood', items: null },
      ],
      30,
    )
    expect(r.measured).toBe(1)
    expect(r.unmeasured).toBe(1)
    expect(r.ok).toBe(1)
    const unm = r.verdicts.find((v) => v.type === 'mood')!
    expect(unm.ok).toBeNull()
    expect(unm.volumes).toBeNull()
    expect(unm.short).toBeNull()
  })

  it('못 잰 칸은 gaps 에도 안 들어간다 — 없는 일을 시키지 않는다', () => {
    const r = soloReport([{ type: 'mood', items: null }], 30)
    expect(r.gaps).toEqual([])
  })

  it('혼합권: 한 칸이라도 못 쟀으면 권 수를 내지 않는다', () => {
    // 빼고 세면 blank 기준 4권이 나오는데, 그건 실제보다 **큰** 수다.
    const v = mixFreedom([
      { type: 'blank', items: 71, needPerVolume: 17 },
      { type: 'mood', items: null, needPerVolume: 5 },
    ])
    expect(v.volumes).toBeNull()
    expect(v.binding).toBeNull()
    expect(v.unmeasured).toEqual(['mood'])
  })
})

describe('혼합권 자유도', () => {
  it('V7 실측 — 1권에서 멈추고, 동점이면 재고가 적은 쪽을 범인으로 든다', () => {
    // long_reference 4/3 = 1 · mood 8/5 = 1 로 **동점**이다. 배열 순서로 이기게 두면
    // 화면이 정렬에 따라 다른 범인을 지목하므로, 재고가 적은 long_reference 를 든다.
    const v = mixFreedom(V7)
    expect(v.volumes).toBe(1)
    expect(v.binding).toBe('long_reference')
  })

  it('동점 판정이 배열 순서에 흔들리지 않는다', () => {
    const forward = mixFreedom(V7)
    const reversed = mixFreedom([...V7].reverse())
    expect(reversed.binding).toBe(forward.binding)
    expect(reversed.volumes).toBe(forward.volumes)
  })

  it('배합에 없는 유형(needPerVolume 0·미지정)은 권 수를 안 묶는다', () => {
    // 재고가 0 이어도 그 권이 안 쓰는 유형이면 막을 이유가 없다.
    const v = mixFreedom([
      { type: 'blank', items: 60, needPerVolume: 20 },
      { type: 'mood', items: 0 },
      { type: 'claim', items: 0, needPerVolume: 0 },
    ])
    expect(v.volumes).toBe(3)
    expect(v.binding).toBe('blank')
  })

  it('배합이 비면 판정하지 않는다 — 0 권이라고 말하지 않는다', () => {
    expect(mixFreedom([{ type: 'blank', items: 999 }])).toEqual({
      volumes: null,
      binding: null,
      unmeasured: [],
    })
  })

  it('재고가 배합에 못 미치면 0 권이고, 그 유형이 binding 이다', () => {
    const v = mixFreedom([
      { type: 'blank', items: 60, needPerVolume: 20 },
      { type: 'long_reference', items: 2, needPerVolume: 3 },
    ])
    expect(v.volumes).toBe(0)
    expect(v.binding).toBe('long_reference')
  })
})

describe('공장 전체 지수', () => {
  const V2: FreedomCell[] = [
    { type: 'long_reference', items: 3, needPerVolume: 3 },
    { type: 'content_match', items: 28, needPerVolume: 5 },
    { type: 'title', items: 141, needPerVolume: 28 },
  ]

  it('두 축을 따로 합산한다', () => {
    const idx = freedomIndex([bandFreedom(2, V2, 30), bandFreedom(7, V7, 30)], 30)
    // V2: title(141) 만 30 이상 → 1. V7: blank·topic·title → 3.
    expect(idx.soloOk).toBe(4)
    expect(idx.soloMeasured).toBe(9)
    // V2 mix: long_reference 3/3 = 1 · content_match 28/5 = 5 · title 141/28 = 5 → 1
    // V7 mix: 1
    expect(idx.mixVolumes).toBe(2)
    expect(idx.mixUnmeasuredBands).toBe(0)
  })

  it('가장 좁은 밴드를 집어낸다 — 거기가 "자유롭지 않다" 의 얼굴이다', () => {
    const wide: FreedomCell[] = [{ type: 'blank', items: 6000, needPerVolume: 20 }]
    const idx = freedomIndex([bandFreedom(5, wide, 30), bandFreedom(7, V7, 30)], 30)
    expect(idx.narrowest?.vLevel).toBe(7)
  })

  it('못 잰 밴드는 총합에서 빠지고 그 수가 남는다', () => {
    const blind: FreedomCell[] = [{ type: 'blank', items: null, needPerVolume: 20 }]
    const idx = freedomIndex([bandFreedom(5, blind, 30), bandFreedom(7, V7, 30)], 30)
    expect(idx.mixVolumes).toBe(1)
    expect(idx.mixUnmeasuredBands).toBe(1)
    expect(idx.soloUnmeasured).toBe(1)
  })

  it('밴드가 없으면 narrowest 는 null — 0 번 밴드를 지어내지 않는다', () => {
    const idx = freedomIndex([], 30)
    expect(idx.narrowest).toBeNull()
    expect(idx.mixVolumes).toBe(0)
  })
})
