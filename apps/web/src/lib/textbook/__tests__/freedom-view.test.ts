// apps/web/src/lib/textbook/__tests__/freedom-view.test.ts
//
// **두 출처를 섞으면 있는 문항이 0 이 된다** — 이 파일이 잠그는 것의 핵심이다.
//
// 스냅샷에는 유형이 두 벌 실린다: `types`(목표 **배합**)와 `stock`(**실재고**).
// 2026-09-15 에 자유도 화면을 붙이면서 `types` 를 재고로 읽었더니, 배합 밖 유형이
// 전부 0 으로 찍혔다 — V3 의 `main_point` 16문항이 "하나도 없음" 으로 보였다.
// "이 권이 안 쓰는 유형" 과 "만들어야 하는 유형" 은 정반대 지시인데 화면이 뒤섞은 것이다.
//
// 그리고 **스냅샷 대조**(`drift`)를 시험한다. 같은 입력에서 스냅샷 자신의 `volumes` 와
// 우리 계산이 갈리면 둘 중 하나가 틀린 것이고, 조용히 다른 수를 말하는 것이 최악이다.

import { describe, expect, it } from 'vitest'

import {
  COMPREHENSION_TYPES,
  SOLO_SIZE,
  bandsFromInventory,
  buildFreedomView,
  cellsOf,
  usesComprehension,
  type SnapBand,
} from '../freedom-view'
import snapshot from '../type-inventory-snapshot.json'

/**
 * 저장소 스냅샷을 **고정 표본**으로 쓴다 — 화면은 이제 집계표를 읽지만(freedom-load.ts),
 * 오프라인 회귀는 DB 없이 돌아야 하므로 2026-09-15 스캔 결과로 계산 규칙을 잠근다.
 */
const snap = snapshot as unknown as { measuredAt: string; bands: SnapBand[] }
const fromSnapshot = () => buildFreedomView(snap.bands, snap.measuredAt)

/** 스냅샷 한 밴드의 모양을 흉내 낸 픽스처. */
const band = (over: Partial<Parameters<typeof cellsOf>[0]> = {}) =>
  ({
    vLevel: 3,
    types: [{ type: 'blank', items: 59, needPerVolume: 11 }],
    stock: [
      { type: 'blank', items: 59, articles: 59 },
      { type: 'main_point', items: 16, articles: 16 },
    ],
    volumes: 5,
    bindingType: 'blank',
    ...over,
  }) as Parameters<typeof cellsOf>[0]

describe('재고는 stock 에서, 배합은 types 에서', () => {
  it('배합에 없지만 재고가 있는 유형을 0 으로 세지 않는다', () => {
    const cells = cellsOf(band(), ['main_point'])
    // `types` 에는 main_point 가 없다. 그것을 재고로 읽으면 0 이 된다 — 그게 그 버그였다.
    expect(cells[0].items).toBe(16)
    expect(cells[0].needPerVolume).toBe(0)
  })

  it('배합에 있는 유형은 needPerVolume 을 갖는다', () => {
    const cells = cellsOf(band(), ['blank'])
    expect(cells[0].items).toBe(59)
    expect(cells[0].needPerVolume).toBe(11)
  })

  it('stock 에도 없는 유형은 진짜 0 이다 — 스캔이 전 유형을 훑기 때문', () => {
    expect(cellsOf(band(), ['mood'])[0].items).toBe(0)
  })

  it('stock 이 아예 없는 낡은 스냅샷은 **못 쟀다**로 둔다 — 0 을 지어내지 않는다', () => {
    const old = band({ stock: undefined })
    const cells = cellsOf(old, ['main_point', 'blank'])
    expect(cells[0].items).toBeNull()
    expect(cells[1].items).toBeNull()
  })
})

describe('범위 — 초등은 수능 이해형을 안 낸다', () => {
  it('배합에 이해형이 없는 밴드는 범위 밖', () => {
    const elementary = band({
      vLevel: 1,
      types: [{ type: 'rhyme', items: 470, needPerVolume: 40 }],
    })
    expect(usesComprehension(elementary)).toBe(false)
  })

  it('배합에 이해형이 하나라도 있으면 범위 안', () => {
    expect(usesComprehension(band())).toBe(true)
  })

  it('실제 스냅샷에서 V1 만 범위 밖이다', () => {
    // 초1용 수능 빈칸추론이 없는 것은 **메워서는 안 되는 구멍**이다.
    expect(fromSnapshot().outOfScope).toEqual([1])
  })
})

describe('실제 스냅샷 — 자유도 기준선', () => {
  const view = fromSnapshot()

  it('스냅샷과 갈리지 않는다 — 갈리면 둘 중 하나가 틀렸다', () => {
    expect(view.drift).toEqual([])
  })

  it('이해형 11종 × 밴드 6 을 잰다', () => {
    expect(COMPREHENSION_TYPES).toHaveLength(11)
    expect(view.index.bands).toHaveLength(6)
    expect(view.index.soloMeasured).toBe(66)
  })

  it('못 잰 칸이 없다 — 있으면 지수의 분모가 조용히 줄어든다', () => {
    expect(view.index.soloUnmeasured).toBe(0)
    expect(view.index.mixUnmeasuredBands).toBe(0)
  })

  /**
   * ⚠️ **회귀 방향만 잠근다.** 정확한 수를 박으면 드레인이 문항을 만들 때마다 시험이
   *   깨진다 — 그건 좋은 변화다. 그래서 "이보다 나빠지면 실패" 로 둔다.
   *   기준선 2026-09-24: 단일유형 20/66 = 30.3% · 혼합권 4권.
   *   gutenberg 퇴출 뒤 스냅샷을 다시 구운 커밋(856a544b)의 실제 모수다. 스냅샷만
   *   바꾸고 2026-09-15 기준을 남겨 CI가 깨졌으므로 같은 측정 시점으로 맞춘다.
   */
  it('기준선 아래로 떨어지지 않는다 (2026-09-24: 20/66 · 4권)', () => {
    expect(view.index.soloOk).toBeGreaterThanOrEqual(20)
    expect(view.index.mixVolumes).toBeGreaterThanOrEqual(4)
  })

  it('가장 좁은 밴드를 집어낸다', () => {
    expect(view.index.narrowest).not.toBeNull()
    expect(view.index.narrowest!.mix.volumes).toBeLessThanOrEqual(1)
  })

  it('특강 크기가 근거 있는 값이다 — 단원 6문항의 배수', () => {
    expect(SOLO_SIZE % 6).toBe(0)
  })
})

describe('라이브 경로 — 집계표 칸에서 밴드를 짓는다', () => {
  /** 스냅샷의 실재고를 집계표 칸 모양으로 편다 — 같은 재고를 두 길로 넣어 본다. */
  const cells = snap.bands.flatMap((b) =>
    (b.stock ?? []).map((s) => ({ type: s.type, vLevel: b.vLevel, items: s.items })),
  )
  const live = buildFreedomView(bandsFromInventory(cells), '2026-09-16T00:00:00Z')

  it('같은 재고면 스냅샷 경로와 **같은 지수**를 낸다 — 출처만 바뀌고 셈은 안 바뀐다', () => {
    const base = fromSnapshot()
    expect(live.index.soloOk).toBe(base.index.soloOk)
    expect(live.index.soloMeasured).toBe(base.index.soloMeasured)
    expect(live.index.mixVolumes).toBe(base.index.mixVolumes)
    expect(live.outOfScope).toEqual(base.outOfScope)
  })

  it('두 계산(배합식 · 패키지)이 갈리지 않는다 — V1 의 빈 배합이 거짓 경보를 내지 않는다', () => {
    expect(live.drift).toEqual([])
  })

  it('사전의 순수 함수 3종은 배합에 넣지 않는다 — 집계표에 없어 거짓 0 이 된다', () => {
    const pure = ['rhyme', 'word_meaning', 'spell_blank']
    for (const b of bandsFromInventory(cells)) {
      expect(b.types.some((t) => pure.includes(t.type))).toBe(false)
    }
  })

  it('재고를 못 읽으면 빈 밴드와 이유를 낸다 — 0 권으로 그리지 않는다', () => {
    const v = buildFreedomView([], null, '재고 집계표를 못 읽었다 — 시험')
    expect(v.index.bands).toEqual([])
    expect(v.loadError).toContain('못 읽었다')
    expect(v.measuredAt).toBeNull()
  })
})
