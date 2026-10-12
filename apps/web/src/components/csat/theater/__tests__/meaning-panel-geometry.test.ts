// apps/web/src/components/csat/theater/__tests__/meaning-panel-geometry.test.ts
//
// v3.1 원문 이해 패널 ↔ 3B 참조 명세(docs/design/refs/3b/meaning-panel/spec.json) — CSS 변수(--msp-*)가 명세 값과 같아야 한다.
// 눈대중으로 고치면 떨어진다. 44px 로 올린 높이는 명세 deviations.minTarget 과 같아야 한다(참조보다 접근성 규칙이 앞선다).
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const spec = JSON.parse(readFileSync(path.join(ROOT, 'docs/design/refs/3b/meaning-panel/spec.json'), 'utf8'))
const css = readFileSync(path.join(__dirname, '../theater.module.css'), 'utf8')
const vars = Object.fromEntries([...css.matchAll(/--(msp-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
const px = (n: number) => `${n}px`

describe('원문 이해 패널 — 3B 명세 = CSS 변수', () => {
  it('카드 · 입력 상자 · 알약', () => {
    expect(vars).toMatchObject({
      'msp-card-bg': spec.card.bg,
      'msp-card-border': spec.card.border,
      'msp-card-radius': px(spec.card.radius),
      'msp-card-gap': px(spec.card.gap),
      'msp-card-inset-x': px(spec.card.insetX),
      'msp-card-pad-y': px(spec.card.padY),
      'msp-field-bg': spec.field.bg,
      'msp-field-h': px(spec.field.h),
      'msp-pill-active-bg': spec.pillActive.bg,
      'msp-pill-active-h': px(spec.pillActive.h),
      'msp-pill-soft-bg': spec.pillSoft.bg,
      'msp-pill-soft-h': px(spec.pillSoft.h),
      'msp-min-target': px(spec.deviations.minTarget),
    })
  })
  it('패널 규칙에 다른 고정 크기 숫자를 다시 쓰지 않는다(변수로만)', () => {
    const block = css.slice(css.indexOf('.msCard {'), css.indexOf('.msPhrases {'))
    expect(block).not.toMatch(/(?:padding|gap|border-radius|min-height):\s*\d+px\s*\d*px?\s*;/)
  })
})
