// packages/design-tokens/src/colors.ts
// SSoT (CLAUDE.md §Colors). Web 은 tokens.css 의 CSS 변수, RN 은 아래 객체를 사용.

export const colorsLight = {
  p: '#3B82F6',
  pHover: '#2563EB',
  pLight: '#EFF6FF',
  pDark: '#1D4ED8',

  active: '#F59E0B',
  activeLight: '#FEF3C7',

  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#06B6D4',
  infoLight: '#CFFAFE',

  bg: '#FFFFFF',
  bg2: '#F8FAFC',
  bg3: '#F1F5F9',

  t1: '#0F172A',
  t2: '#475569',
  t3: '#94A3B8',
  t4: '#CBD5E1',
  ti: '#FFFFFF',

  bd: '#E2E8F0',
  bdf: '#3B82F6',
  bde: '#EF4444',
} as const;

export const colorsDark = {
  ...colorsLight,
  p: '#60A5FA',
  pHover: '#93C5FD',
  pLight: '#1E3A5F',
  pDark: '#3B82F6',

  activeLight: '#451A03',
  success: '#4ADE80',
  successLight: '#052E16',
  error: '#F87171',
  errorLight: '#3B0A0A',
  infoLight: '#083344',
  warningLight: '#3B2000',

  bg: '#0B1120',
  bg2: '#141E30',
  bg3: '#1E2D42',

  t1: '#F1F5F9',
  t2: '#CBD5E1',
  t3: '#64748B',
  t4: '#334155',

  bd: '#1E2D42',
  bdf: '#60A5FA',
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
