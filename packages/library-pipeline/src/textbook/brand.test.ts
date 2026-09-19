// packages/library-pipeline/src/textbook/brand.test.ts
//
// 이 파일의 일은 **드리프트를 잡는 것**이다. 값을 여기 다시 적으면 세 곳이 되어
// 더 나빠지므로, 토큰 패키지에서 읽어 조판 팔레트와 대조한다.

import { colorsDark, colorsLight, fontFamily } from '@vocaflow/design-tokens'
import { describe, expect, it } from 'vitest'
import {
  SERIES_BRAND,
  VOLUME_FONTS,
  VOLUME_METRICS,
  VOLUME_PALETTE,
  VOLUME_TYPE_SCALE,
  brandFingerprint,
  brandSpecRows,
  buildColophon,
  ladderStrip,
  volumeCssVariables,
  volumeMetricsCss,
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

describe('brandFingerprint — 옛 규격으로 찍힌 권을 가려내는 지문', () => {
  it('안정적이다 — 같은 규격이면 몇 번을 불러도 같은 값', () => {
    expect(brandFingerprint()).toBe(brandFingerprint())
  })

  it('8자리 16진수다 — DB 에 그대로 들어간다', () => {
    expect(brandFingerprint()).toMatch(/^[0-9a-f]{8}$/)
  })

  it('**색을 복사해 두지 않는다** — 지문은 값이 아니라 값의 요약이다', () => {
    // 지문 안에서 실제 색을 읽어낼 수 있으면 정본이 둘이 된 것이다.
    expect(brandFingerprint()).not.toContain(colorsLight.t1.replace('#', '').toLowerCase())
  })
})

describe('brandSpecRows — 관리자가 읽는 규격표', () => {
  const rows = brandSpecRows()

  it('팔레트 여섯 자리를 전부 낸다', () => {
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.key)).toEqual(['ink', 'sub', 'line', 'bg', 'accent', 'slot'])
  })

  it('값은 토큰에서 온다 — 표에 값을 다시 적지 않았다', () => {
    const ink = rows.find((r) => r.key === 'ink')!
    expect(ink.light).toBe(colorsLight.t1)
    expect(ink.dark).toBe(colorsDark.t1)
  })

  it('**색 이름이 아니라 지면에서의 자리를 적는다** — 관리자는 `slot` 을 모른다', () => {
    for (const r of rows) {
      expect(r.label.length, r.key).toBeGreaterThan(1)
      expect(r.label, r.key).not.toBe(r.key)
    }
  })
})

// ── 활자 스케일 (2026-09-06) ────────────────────────────────────────
//
// 팔레트를 토큰으로 옮긴 뒤에도 **치수는 조판기 안에 남아 있었다.** 세어 보니 글자 크기가
// 11종이고 그중 넷이 0.02rem 차이였다 — 스케일이 아니라 누적된 임시값이었다.
// 이 블록의 일은 그 상태로 되돌아가지 않게 막는 것이다.

describe('조판 활자 스케일', () => {
  const steps = Object.values(VOLUME_TYPE_SCALE).map((v) => parseFloat(v))

  it('7단이고, 작은 쪽부터 커진다', () => {
    expect(steps).toHaveLength(7)
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
  })

  // ⚠️ 이 검사가 이 파일의 핵심이다. 단계가 서로 구별되지 않으면 **단계가 아니다** —
  //    옛 상태(.72 · .74 · .76)가 정확히 그랬고, 새 값을 넣을 때 같은 일이 또 일어난다.
  it('이웃한 두 단이 0.05rem 안으로 붙지 않는다 — 구별되지 않으면 단계가 아니다', () => {
    const tooClose = steps
      .slice(1)
      .map((v, i) => ({ a: steps[i] as number, b: v, gap: +(v - (steps[i] as number)).toFixed(3) }))
      .filter((x) => x.gap < 0.05)
    expect(tooClose).toEqual([])
  })

  it('CSS 변수로 일곱 단과 지면 규격을 전부 낸다', () => {
    const css = volumeMetricsCss()
    for (const k of ['micro', 'caption', 'small', 'body', 'stem', 'title', 'display']) {
      expect(css).toContain(`--fs-${k}:`)
    }
    expect(css).toContain(`--measure:${VOLUME_METRICS.measure}`)
    expect(css).toContain(`--leading:${VOLUME_METRICS.leading}`)
  })

  it('규격을 여기 적고 조판기에 다시 적지 않는다 — 값이 두 곳이 되면 갈라진다', async () => {
    // 조판기 소스를 직접 읽어 **원시 치수가 남아 있는지** 본다. 팔레트 때와 같은 방식이다.
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { join, dirname } = await import('node:path')
    const here = dirname(fileURLToPath(import.meta.url))
    const renderer = join(here, '..', '..', '..', '..', 'scripts', 'textbook', 'render-volume.mjs')
    let src: string
    try {
      src = readFileSync(renderer, 'utf8')
    } catch {
      // 조판기가 없는 배포판(패키지만 설치)에서는 이 검사를 건너뛴다.
      return
    }
    // `font-size:.86rem` 같은 원시 값이 하나라도 남으면 실패. 변수(`var(--fs-*)`)만 허용.
    const raw = src.match(/font-size:s*[0-9.]+rem/g) ?? []
    expect(raw).toEqual([])
  })
})
