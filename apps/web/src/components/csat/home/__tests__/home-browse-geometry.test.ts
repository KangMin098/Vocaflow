// apps/web/src/components/csat/home/__tests__/home-browse-geometry.test.ts
//
// v3 M1 지도 홈 · 기출 탐구 조건 ↔ 3B 참조 명세(docs/design/refs/3b/home-browse/spec.json) — CSS 변수가 명세 값과 같아야 한다.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const spec = JSON.parse(readFileSync(path.join(ROOT, 'docs/design/refs/3b/home-browse/spec.json'), 'utf8'))
const vars = (file: string, prefix: string) =>
  Object.fromEntries([...readFileSync(file, 'utf8').matchAll(new RegExp(`--(${prefix}-[a-z-]+):\\s*([^;]+);`, 'g'))].map((m) => [m[1], m[2].trim()]))
const px = (n: number) => `${n}px`

describe('3B 명세 = CSS 변수', () => {
  it('지도 홈(--hl-*)', () => {
    expect(vars(path.join(__dirname, '../home-landing.module.css'), 'hl')).toMatchObject({
      'hl-card-bg': spec.card.bg,
      'hl-card-border': spec.card.border,
      'hl-card-radius': px(spec.card.radius),
      'hl-card-pad-y': px(spec.card.padY),
      'hl-card-inset-x': px(spec.card.insetX),
      'hl-pill-soft-bg': spec.pillSoft.bg,
      'hl-primary-bg': spec.primary.bg,
      'hl-primary-fg': spec.primary.fg,
      'hl-radius-pill': px(spec.radiusPill),
      'hl-min-target': px(spec.deviations.minTarget),
    })
  })
  it('기출 탐구 조건(--bc-*)', () => {
    expect(vars(path.join(__dirname, '../../browse/browse-conditions.module.css'), 'bc')).toMatchObject({
      'bc-field-bg': spec.field.bg,
      'bc-field-border': spec.field.border,
      'bc-primary-bg': spec.primary.bg,
      'bc-primary-fg': spec.primary.fg,
      'bc-radius-pill': px(spec.radiusPill),
      'bc-min-target': px(spec.deviations.minTarget),
    })
  })
})
