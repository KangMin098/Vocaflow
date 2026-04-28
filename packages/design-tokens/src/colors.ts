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
