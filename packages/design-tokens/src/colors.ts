// packages/design-tokens/src/colors.ts
// SSoT (CLAUDE.md §Colors). Web 은 tokens.css 의 CSS 변수, RN 은 아래 객체를 사용.
//
// v06.37 — iOS HIG 색상 풀 정렬:
//  · 브랜드 = iOS systemBlue (#007AFF)
//  · semantic = iOS systemGreen/Red/Orange/Cyan
//  · 캔버스 = iOS systemGroupedBackground (#F2F2F7)
//  · 텍스트 = iOS label (warm-neutral alpha, NOT cool slate)
//  · 다크 = iOS 순흑 캔버스 + #1C1C1E 카드

export const colorsLight = {
  // 브랜드 = iOS systemIndigo (학습 플랫폼 정합 — systemBlue 가 아닌 이유 § DESIGN_SYSTEM.md)
  p: '#5856D6',          // iOS systemIndigo
  pHover: '#4946C2',
  pLight: '#EBEAFB',
  pDark: '#3C3AAB',

  active: '#FF9500',     // iOS systemOrange (active)
  activeLight: '#FFF1E5',

  success: '#34C759',    // iOS systemGreen
  successLight: '#E5F8EC',
  error: '#FF3B30',      // iOS systemRed
  errorLight: '#FFE5E5',
  warning: '#FF9500',    // iOS systemOrange
  warningLight: '#FFF1E5',
  info: '#32ADE6',       // iOS systemCyan
  infoLight: '#E5F4FB',

  bg: '#FFFFFF',         // secondarySystemGroupedBackground (card)
  bg2: '#F2F2F7',        // systemGroupedBackground (canvas) — ★ iOS 시그니처 톤
  bg3: '#E5E5EA',        // systemGray5 (fill)

  t1: '#000000',                          // label
  t2: 'rgba(60, 60, 67, 0.60)',            // secondaryLabel
  t3: 'rgba(60, 60, 67, 0.30)',            // tertiaryLabel
  t4: 'rgba(60, 60, 67, 0.18)',            // quaternaryLabel
  ti: '#FFFFFF',

  bd: '#C6C6C8',         // iOS separator (opaque)
  bdf: '#007AFF',
  bde: '#FF3B30',
} as const;

export const colorsDark = {
  ...colorsLight,
  p: '#5E5CE6',                              // iOS systemIndigo dark vivid
  pHover: '#7270E8',
  pLight: 'rgba(94, 92, 230, 0.18)',
  pDark: '#4F4DD0',

  active: '#FF9F0A',
  activeLight: 'rgba(255, 159, 10, 0.18)',
  success: '#30D158',
  successLight: 'rgba(48, 209, 88, 0.18)',
  error: '#FF453A',
  errorLight: 'rgba(255, 69, 58, 0.18)',
  warning: '#FF9F0A',
  warningLight: 'rgba(255, 159, 10, 0.18)',
  info: '#64D2FF',
  infoLight: 'rgba(100, 210, 255, 0.18)',

  bg: '#1C1C1E',         // secondarySystemGroupedBackground dark (card)
  bg2: '#000000',        // systemGroupedBackground dark (canvas) — 순흑
  bg3: '#2C2C2E',        // tertiarySystemFill dark

  t1: '#FFFFFF',
  t2: 'rgba(235, 235, 245, 0.60)',
  t3: 'rgba(235, 235, 245, 0.30)',
  t4: 'rgba(235, 235, 245, 0.16)',

  bd: '#38383A',         // iOS separator dark
  bdf: '#0A84FF',
} as const;

// iOS 시스템 컬러 (HIG light) — 의미별 액센트. 브랜드 --p 와 별도로 사용.
// v06.36 도입 — UI 캡슐 배지·CTA tone·상태 강조에 사용.
export const iosColors = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  mint: '#00C7BE',
  teal: '#30B0C7',
  cyan: '#32ADE6',
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  pink: '#FF2D55',
  brown: '#A2845E',

  gray1: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',

  // tints (UI 배지 bg)
  redTint: '#FFE5E5',
  orangeTint: '#FFF1E5',
  yellowTint: '#FEF3C7',
  greenTint: '#E8F8EE',
  blueTint: '#E5F2FF',
  purpleTint: '#F3E8FF',
  pinkTint: '#FCE7F3',
} as const;

// iOS 다크 — Vivid 컬러로 대비 보장 (HIG spec)
export const iosColorsDark = {
  ...iosColors,
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  green: '#30D158',
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  pink: '#FF375F',

  gray1: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  gray6: '#1C1C1E',
} as const;

export type IosColors = typeof iosColors;

// 게임 전용 — 변경 금지 (CLAUDE.md §게임 전용 하드코딩 색상 예외)
export const gameColors = {
  gold: '#EAB308',
  silver: '#94A3B8',
  bronze: '#D97706',
  combo: '#8B5CF6',
  streak: '#EC4899',

  wordBlitzGold: '#FFE234',
  wordBlitzGreen: '#3d8a3d',
  spellForgeBlue: '#4A9FCF',
  spellForgeBlueDark: '#3A7FAF',
} as const;

export type Colors = typeof colorsLight;
