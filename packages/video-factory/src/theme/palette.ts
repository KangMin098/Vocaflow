// packages/video-factory/src/theme/palette.ts
//
// **영상의 색은 전부 `@vocaflow/design-tokens` 에서 온다.**
//
// 영상이 제품과 다른 색을 쓰면 광고를 보고 온 사람이 다른 서비스에 도착한 것처럼 느낀다.
// 그래서 여기서 hex 를 **새로 적지 않는다** — 토큰에서 읽어 이름만 붙인다.
// (회귀 `__tests__/palette.test.ts` 가 "여기 hex 리터럴 0개" 를 잠근다.)

import { colorsLight } from '@vocaflow/design-tokens'
import type { AccentKey } from '../spec/types'

export const ACCENT: Record<AccentKey, string> = {
  brand: colorsLight.p,
  gold: colorsLight.active,
  forest: colorsLight.success,
  amber: colorsLight.warning,
  clay: colorsLight.error,
  slate: colorsLight.info,
}

export const ACCENT_SOFT: Record<AccentKey, string> = {
  brand: colorsLight.pLight,
  gold: colorsLight.activeLight,
  forest: colorsLight.successLight,
  amber: colorsLight.warningLight,
  clay: colorsLight.errorLight,
  slate: colorsLight.infoLight,
}

/**
 * 영상 배경 — 제품의 종이 톤(Reading Room 아트디렉션).
 * 검은 배경을 쓰지 않는 이유: 제품 화면이 종이색이라 컷이 바뀔 때 제품이 이물처럼 보인다.
 */
export const SURFACE = {
  page: colorsLight.bg,
  canvas: colorsLight.bg2,
  edge: colorsLight.bg3,
  card: colorsLight.bg,
  border: colorsLight.bd,
  ink: colorsLight.t1,
  inkMuted: colorsLight.t2,
  inkFaint: colorsLight.t3,
  inverted: colorsLight.ti,
} as const

/**
 * Memory Decay 4색 — CLAUDE.md §Memory Decay 와 **같은 값**이어야 한다.
 * `memory_state` 를 DB 에 저장하지 않는 것처럼, 여기서도 색을 저장하지 않고 R(t) 로 고른다.
 */
export const DECAY = {
  stable: colorsLight.success,
  shaky: colorsLight.warning,
  risk: colorsLight.error,
  new: colorsLight.t3,
} as const

/** R(t) → 색. 임계는 CLAUDE.md 표 그대로(0.95 / 0.70). */
export function decayColor(retention: number): string {
  if (retention >= 0.95) return DECAY.stable
  if (retention >= 0.7) return DECAY.shaky
  return DECAY.risk
}

/** R(t) = exp(ln(0.9) · t / S) — 저장하지 않고 그 자리에서 계산한다. */
export function retention(days: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.exp((Math.log(0.9) * days) / stability)
}

/** 폰트 — 4종 고정(Plus Jakarta Sans · DM Sans · Lora · JetBrains Mono). */
export const FONT = {
  display: '"Plus Jakarta Sans", system-ui, sans-serif',
  body: '"DM Sans", system-ui, sans-serif',
  english: 'Lora, Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const
