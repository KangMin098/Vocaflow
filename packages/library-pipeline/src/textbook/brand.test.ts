// packages/library-pipeline/src/textbook/brand.test.ts
//
// 조판 브랜드(CSS 변수 · 판권면 · 지문 · 규격표 · 활자 스케일 변수)의 동작 계약을 검사한다.

import { describe, expect, it } from 'vitest'
import {
  SERIES_BRAND,
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

// 디자인 금지 검사 6건(팔레트를 토큰 값에 묶기 2 · 옛 팔레트 금지 · 영문 지문 Lora · 활자 단 간격 · 조판기 원시 치수 금지)은 DD-66(사용자 결정 2026-09-21)으로 삭제했다.

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
    expect(bare).toContain(VOLUME_PALETTE.light.ink)
    expect(bare).toContain(VOLUME_PALETTE.light.bg)
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
    expect(brandFingerprint()).not.toContain(VOLUME_PALETTE.light.ink.replace('#', '').toLowerCase())
  })
})

describe('brandSpecRows — 관리자가 읽는 규격표', () => {
  const rows = brandSpecRows()

  it('팔레트 여섯 자리를 전부 낸다', () => {
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.key)).toEqual(['ink', 'sub', 'line', 'bg', 'accent', 'slot'])
  })

  it('값은 팔레트에서 온다 — 표에 값을 다시 적지 않았다', () => {
    const ink = rows.find((r) => r.key === 'ink')!
    expect(ink.light).toBe(VOLUME_PALETTE.light.ink)
    expect(ink.dark).toBe(VOLUME_PALETTE.dark.ink)
  })

  it('**색 이름이 아니라 지면에서의 자리를 적는다** — 관리자는 `slot` 을 모른다', () => {
    for (const r of rows) {
      expect(r.label.length, r.key).toBeGreaterThan(1)
      expect(r.label, r.key).not.toBe(r.key)
    }
  })
})

// ── 활자 스케일 (2026-09-06) ────────────────────────────────────────

describe('조판 활자 스케일', () => {
  const steps = Object.values(VOLUME_TYPE_SCALE).map((v) => parseFloat(v))

  it('7단이고, 작은 쪽부터 커진다', () => {
    expect(steps).toHaveLength(7)
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
  })

  it('CSS 변수로 일곱 단과 지면 규격을 전부 낸다', () => {
    const css = volumeMetricsCss()
    for (const k of ['micro', 'caption', 'small', 'body', 'stem', 'title', 'display']) {
      expect(css).toContain(`--fs-${k}:`)
    }
    expect(css).toContain(`--measure:${VOLUME_METRICS.measure}`)
    expect(css).toContain(`--leading:${VOLUME_METRICS.leading}`)
  })
})

describe('조판 팔레트 덮어쓰기 (DD-66 — 팔레트 = 토큰 고정 해제)', () => {
  it('인자가 없으면 토큰 팔레트 그대로다', () => {
    expect(volumeCssVariables()).toBe(volumeCssVariables({}))
    expect(volumeCssVariables()).toContain(`--ink:${VOLUME_PALETTE.light.ink}`)
  })

  it('적은 자리만 바꾸고 나머지는 토큰 값을 둔다', () => {
    const css = volumeCssVariables({ light: { slot: '#c0392b' }, dark: { bg: '#101010' } })
    expect(css).toContain('--slot:#c0392b')
    expect(css).toContain('--bg:#101010')
    expect(css).toContain(`--ink:${VOLUME_PALETTE.light.ink}`)
  })
})
