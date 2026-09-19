// packages/library-pipeline/src/textbook/series-ink.test.ts
//
// **표지 색이 시리즈를 가르는지, 그러면서 읽히는지** 재서 확인한다.
//
// 색은 눈으로 고르기 쉽고 그래서 조용히 무너진다. 여기서 재는 것은 셋이다:
//   · **같은 단의 다른 시리즈**가 눈으로 갈리는가 (RGB 거리)
//   · **같은 시리즈의 다른 단**이 눈으로 갈리는가 (한 색으로 뭉치면 사다리가 안 보인다)
//   · 색면 위의 **종이색 글자가 읽히는가** (대비비 — 권 번호가 여기 얹힌다)

import { describe, expect, it } from 'vitest'

import { RUNG_INK } from './cover'
import { SERIES_CATALOG } from './series-catalog'
import {
  COVER_PAPER,
  contrastRatio,
  rgbDistance,
  relativeLuminance,
  seriesInk,
  seriesInkRamp,
} from './series-ink'

/** `cover.ts` 가 「눈으로 갈린다」고 판정한 기준선 — 기존 램프의 최소 거리 40.0. */
const MIN_DISTANCE = 24

/** 색면 위 종이색 글자. 권 번호는 크지만 깊이 표시는 작아서 본문 기준(4.5)을 쓴다. */
const MIN_CONTRAST = 4.5

describe('시리즈 잉크', () => {
  it('같은 단의 다른 시리즈가 눈으로 갈린다 — 안 갈리면 매대에서 한 시리즈가 된다', () => {
    const steps = [2, 5, 7]
    for (const step of steps) {
      const inks = SERIES_CATALOG.map((s) => ({
        brand: s.brand,
        ink: seriesInk(s.accent, step, s.rungs.length),
      }))
      for (let i = 0; i < inks.length; i += 1) {
        for (let j = i + 1; j < inks.length; j += 1) {
          const d = rgbDistance(inks[i]!.ink, inks[j]!.ink)
          expect(
            d,
            `${step}단에서 ${inks[i]!.brand}(${inks[i]!.ink}) 와 ${inks[j]!.brand}(${inks[j]!.ink}) 가 ${d.toFixed(1)} 밖에 안 떨어진다`,
          ).toBeGreaterThan(MIN_DISTANCE)
        }
      }
    }
  })

  it('같은 시리즈 안에서 단이 갈린다 — 한 색으로 뭉치면 사다리가 안 보인다', () => {
    for (const s of SERIES_CATALOG) {
      const ramp = seriesInkRamp(s.accent, s.rungs.length)
      for (let i = 1; i < ramp.length; i += 1) {
        expect(
          rgbDistance(ramp[i - 1]!, ramp[i]!),
          `${s.brand} ${i}단과 ${i + 1}단이 너무 가깝다`,
        ).toBeGreaterThan(8)
      }
      // 끝에서 끝은 확실히 달라야 한다 — 사다리의 깊이가 색으로 읽히는 근거다.
      expect(rgbDistance(ramp[0]!, ramp[ramp.length - 1]!)).toBeGreaterThan(MIN_DISTANCE)
    }
  })

  it('색면 위 종이색 글자가 읽힌다 — 권 번호가 여기 얹힌다', () => {
    for (const s of SERIES_CATALOG) {
      for (const ink of seriesInkRamp(s.accent, s.rungs.length)) {
        const c = contrastRatio(ink, COVER_PAPER)
        expect(c, `${s.brand} 의 ${ink} 위에서 종이색이 ${c.toFixed(2)}:1 로 안 읽힌다`).toBeGreaterThanOrEqual(
          MIN_CONTRAST,
        )
      }
    }
  })

  it('단이 오를수록 어두워진다 — 깊이가 방향을 가져야 사다리로 읽힌다', () => {
    for (const s of SERIES_CATALOG) {
      const ramp = seriesInkRamp(s.accent, s.rungs.length)
      for (let i = 1; i < ramp.length; i += 1) {
        expect(
          relativeLuminance(ramp[i]!),
          `${s.brand} ${i + 1}단이 앞 단보다 밝다`,
        ).toBeLessThan(relativeLuminance(ramp[i - 1]!))
      }
    }
  })

  it('명도 범위가 기존 램프 안에 있다 — 표지가 갑자기 밝아지거나 어두워지지 않는다', () => {
    // 기존 `RUNG_INK` 의 휘도 범위를 자로 쓴다 — 그 램프는 이미 표지에서 검증된 값이다.
    const base = RUNG_INK.map(relativeLuminance)
    const lo = Math.min(...base)
    const hi = Math.max(...base)
    for (const s of SERIES_CATALOG) {
      for (const ink of seriesInkRamp(s.accent, s.rungs.length)) {
        const y = relativeLuminance(ink)
        expect(y, `${s.brand} 의 ${ink} 가 기존 램프보다 어둡다`).toBeGreaterThanOrEqual(lo * 0.6)
        expect(y, `${s.brand} 의 ${ink} 가 기존 램프보다 밝다`).toBeLessThanOrEqual(hi * 1.6)
      }
    }
  })

  it('단이 하나뿐인 시리즈도 끝값으로 쏠리지 않는다', () => {
    const one = seriesInk('#2E7D5A', 1, 1)
    const first = seriesInk('#2E7D5A', 1, 7)
    const last = seriesInk('#2E7D5A', 7, 7)
    expect(relativeLuminance(one)).toBeLessThan(relativeLuminance(first))
    expect(relativeLuminance(one)).toBeGreaterThan(relativeLuminance(last))
  })

  it('6자리 hex 가 아니면 던진다 — 조용히 검정으로 떨어지면 표지가 다 같아진다', () => {
    expect(() => seriesInk('green', 1, 7)).toThrow()
    expect(() => seriesInk('#fff', 1, 7)).toThrow()
  })
})
