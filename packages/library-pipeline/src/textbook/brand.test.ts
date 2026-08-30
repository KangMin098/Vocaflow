// packages/library-pipeline/src/textbook/brand.test.ts
//
// 이 파일의 일은 **드리프트를 잡는 것**이다. 값을 여기 다시 적으면 세 곳이 되어
// 더 나빠지므로, 토큰 패키지에서 읽어 조판 팔레트와 대조한다.

import { colorsDark, colorsLight, fontFamily } from '@vocaflow/design-tokens'
import { describe, expect, it } from 'vitest'
import {
  SERIES_BRAND,
  VOLUME_FONTS,
  VOLUME_PALETTE,
  buildColophon,
  ladderStrip,
  volumeCssVariables,
} from './brand'

describe('조판 팔레트가 디자인 토큰과 어긋나지 않는다', () => {
  it('라이트 — 여섯 색이 전부 토큰 값이다', () => {
    expect(VOLUME_PALETTE.light.ink).toBe(colorsLight.t1)
    expect(VOLUME_PALETTE.light.sub).toBe(colorsLight.t3)
    expect(VOLUME_PALETTE.light.line).toBe(colorsLight.bd)
    expect(VOLUME_PALETTE.light.bg).toBe(colorsLight.bg)
    expect(VOLUME_PALETTE.light.accent).toBe(colorsLight.activeInk)
    expect(VOLUME_PALETTE.light.slot).toBe(colorsLight.p)
  })

  it('다크 — 여섯 색이 전부 토큰 값이다', () => {
    expect(VOLUME_PALETTE.dark.ink).toBe(colorsDark.t1)
    expect(VOLUME_PALETTE.dark.sub).toBe(colorsDark.t3)
    expect(VOLUME_PALETTE.dark.line).toBe(colorsDark.bd)
    expect(VOLUME_PALETTE.dark.bg).toBe(colorsDark.bg2)
    expect(VOLUME_PALETTE.dark.accent).toBe(colorsDark.activeInk)
    expect(VOLUME_PALETTE.dark.slot).toBe(colorsDark.p)
  })

  it('조판기가 쓰던 옛 팔레트로 되돌아가지 않는다', () => {
    // 2026-08-30 이전 render-volume.mjs 의 하드코딩 값. 다시 나타나면 실패한다.
    const retired = ['#7a3b2e', '#1a1a1a', '#fbfaf7', '#d8d4cd', '#b8542f']
    const inUse = [
      ...Object.values(VOLUME_PALETTE.light),
      ...Object.values(VOLUME_PALETTE.dark),
    ].map((v) => v.toLowerCase())
    for (const old of retired) expect(inUse).not.toContain(old)
  })

  it('영문 지문 서체는 Lora — v06.39 시그니처다', () => {
    expect(VOLUME_FONTS.english).toBe(fontFamily.english.join(', '))
    expect(VOLUME_FONTS.english).toContain('Lora')
    expect(VOLUME_FONTS.english).not.toContain('Iowan')
  })
})

describe('volumeCssVariables — 세 테마 상태를 모두 낸다', () => {
  const css = volumeCssVariables()

  it('무표시(system) · light · dark 세 갈래가 다 있다', () => {
    expect(css).toContain(':root{')
    expect(css).toContain('@media(prefers-color-scheme:dark)')
    expect(css).toContain(':root:not([data-theme="light"])')
    expect(css).toContain(':root[data-theme="dark"]')
  })

  it('라이트 값은 bare :root 에 있다 — 미디어 쿼리 안에만 있으면 무표시에서 색을 잃는다', () => {
    const bare = css.split('\n')[0] ?? ''
    expect(bare).toContain(colorsLight.t1)
    expect(bare).toContain(colorsLight.bg)
  })
})

describe('buildColophon — 판권면', () => {
  const base = {
    title: 'Vocaflow Reading 4',
    step: 5,
    schoolBand: '고1',
    vLevel: 5,
    issued: new Date('2026-08-30T00:00:00Z'),
    autoPassed: 8,
    autoTotal: 9,
  }

  it('사다리 자리를 사람이 읽을 수 있게 적는다', () => {
    expect(buildColophon(base).ladder).toBe('5단 · 고1')
  })

  it('사다리 밖이면 레벨로 적는다 — 지어내지 않는다', () => {
    expect(buildColophon({ ...base, step: null, schoolBand: null }).ladder).toBe('V5')
  })

  it('검수 수치는 받은 값을 그대로 쓴다', () => {
    expect(buildColophon(base).review).toBe('자동 검수 8/9 통과')
  })

  it('발행일은 ISO 날짜 · 출처 정책이 비어 있지 않다', () => {
    const c = buildColophon(base)
    expect(c.issued).toBe('2026-08-30')
    expect(c.edition).toBe('초판 2026')
    expect(c.sourcePolicy.length).toBeGreaterThan(20)
    expect(c.sourcePolicy).toContain('출처')
  })
})

describe('ladderStrip — 뒤표지 시리즈 표시', () => {
  it('현재 권만 표시된다', () => {
    expect(ladderStrip(5)).toEqual(['1', '2', '3', '4', '[5]', '6', '7'])
  })

  it('사다리 밖이면 아무 단도 표시하지 않는다', () => {
    expect(ladderStrip(null)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })
})

describe('SERIES_BRAND', () => {
  it('시리즈 이름은 한 곳에서만 온다', () => {
    expect(SERIES_BRAND).toBe('Vocaflow Reading')
  })
})
