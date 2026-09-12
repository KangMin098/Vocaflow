// packages/library-pipeline/src/vocab/brand-canvas.test.ts
//
// 브랜드 캔버스가 **토큰을 우회하지 못하게** 막는가, 그리고 **빈 것을 통과시키지 않는가**.
//
// 이 두 가지가 이 파일의 전부다. 색을 값으로 담으면 토큰이 정본이 아니게 되고(저장소가 두 번
// 겪은 사고), 빈 브랜드가 적재되면 다음 export 가 "이미 했다" 로 세어 그 계열이 영영 빈 채로 남는다.

import { describe, expect, it } from 'vitest'
import { BRAND_FAMILIES, resolveBrandColors, validateBrandCanvas, type VocabBrandCanvas } from './brand-canvas'

const ok = (over: Partial<VocabBrandCanvas> = {}): VocabBrandCanvas => ({
  family: 'list',
  seriesLine: '목록 계열',
  grain: '축적과 질서 — 세어서 줄 세운 것',
  lockup: { kicker: 'VOCAFLOW VOCABULARY', volumeFormat: 'VOL. {n}', titleMaxLines: 2 },
  coverGrid: { ratio: '3:4', plateInset: 8, scrimStrength: 0.35 },
  palette: { ink: 'ink', paper: 'paper', accent: 'accent' },
  typography: { display: 'english', body: 'body', numerals: 'mono' },
  canvasUrl: null,
  designedAt: '2026-09-06T00:00:00.000Z',
  designedBy: 'claude-design',
  ...over,
})

describe('브랜드 캔버스 검증', () => {
  it('바른 캔버스는 통과한다', () => {
    expect(validateBrandCanvas(ok())).toEqual([])
  })

  it('계열 다섯이 듀오톤 표와 같은 눈금이다', () => {
    expect(BRAND_FAMILIES).toEqual(['list', 'structure', 'corpus', 'delivery', 'unique'])
  })

  it('**색 값을 담을 수 없다** — hex 는 어느 자리에 있든 걸린다', () => {
    const p = validateBrandCanvas(ok({ seriesLine: '목록 #2E7D5A 계열' }))
    expect(p.some((x) => x.message.includes('색 값'))).toBe(true)
  })

  it('rgb()·hsl() 도 막는다 — hex 만 막으면 우회로가 남는다', () => {
    for (const v of ['rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(1 2% 3%)']) {
      const p = validateBrandCanvas(ok({ grain: `축적과 질서 ${v}` }))
      expect(p.some((x) => x.message.includes('색 값'))).toBe(true)
    }
  })

  it('색 자리에 값 대신 **역할 이름**을 요구한다', () => {
    const p = validateBrandCanvas(ok({ palette: { ink: 'navy' as never, paper: 'paper', accent: 'accent' } }))
    expect(p.some((x) => x.field === 'palette.ink')).toBe(true)
  })

  it('빈 값을 통과시키지 않는다 — 빈 브랜드가 적재되면 그 계열이 영영 빈 채로 남는다', () => {
    expect(validateBrandCanvas(ok({ seriesLine: ' ' })).some((x) => x.field === 'seriesLine')).toBe(true)
    expect(validateBrandCanvas(ok({ grain: '짧다' })).some((x) => x.field === 'grain')).toBe(true)
  })

  it('권 번호 표기에 번호 자리가 없으면 거절한다', () => {
    const p = validateBrandCanvas(ok({ lockup: { kicker: 'K', volumeFormat: 'VOL.', titleMaxLines: 2 } }))
    expect(p.some((x) => x.field === 'lockup.volumeFormat')).toBe(true)
  })

  it('표지 비율과 스크림 범위를 지킨다', () => {
    expect(
      validateBrandCanvas(ok({ coverGrid: { ratio: '가로세로', plateInset: 0, scrimStrength: 0.2 } }))
        .some((x) => x.field === 'coverGrid.ratio'),
    ).toBe(true)
    expect(
      validateBrandCanvas(ok({ coverGrid: { ratio: '3:4', plateInset: 0, scrimStrength: 1.5 } }))
        .some((x) => x.field === 'coverGrid.scrimStrength'),
    ).toBe(true)
  })

  it('출처를 속일 수 없다 — designedBy 는 claude-design 뿐', () => {
    expect(validateBrandCanvas(ok({ designedBy: 'hand' as never })).some((x) => x.field === 'designedBy')).toBe(true)
  })

  it('객체가 아니면 그 자리에서 거절한다', () => {
    expect(validateBrandCanvas(null)).toHaveLength(1)
    expect(validateBrandCanvas('brand')).toHaveLength(1)
  })
})

describe('색은 늘 토큰에서 푼다', () => {
  it('규격이 아니라 듀오톤 표가 색을 준다', () => {
    const light = resolveBrandColors(ok({ family: 'structure' }), 'light')
    const dark = resolveBrandColors(ok({ family: 'structure' }), 'dark')
    expect(light.ink).toMatch(/^#|^rgb/)
    expect(dark.ink).toMatch(/^#|^rgb/)
    // 라이트와 다크가 같으면 테마가 짝을 이루지 않는다는 뜻이다.
    expect(light.paper).not.toBe(dark.paper)
  })

  it('계열이 다르면 색도 다르다 — 그래야 서가에서 계열이 구별된다', () => {
    const seen = new Set(BRAND_FAMILIES.map((f) => resolveBrandColors(ok({ family: f }), 'light').ink))
    expect(seen.size).toBe(BRAND_FAMILIES.length)
  })
})
