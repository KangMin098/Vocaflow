// packages/design-tokens/src/colors.ts
// SSoT (CLAUDE.md §Colors). Web 은 tokens.css 의 CSS 변수, RN 은 아래 객체를 사용.
//
// v06.39 — Reading Room Art Direction:
//  · 브랜드 = ink navy (#1E3A5F) — 차분한 권위 (제네릭 blue 탈출)
//  · 액센트 = muted gold (#B8893B) — 금고/금박 보상색
//  · semantic = paper-tone (채도 1-2단 하향)
//  · canvas = warm paper #F2EEE6, card = #FAF8F3, 텍스트 = ink #1C1815
//  · 다크 = warm ink dark (#16130E), 순흑 X
//  · iOS HIG 골격 (Card/Frame/Screen/SegmentControl/etc.) 그대로 유지

// v06.40 — Contemporary Editorial refinement
// Benchmark: Apple Books (warm off-white) + Linear (single accent) +
// Things 3 (precision) + Reflect (cream sophistication) + Substack (serif)
export const colorsLight = {
  // 브랜드 = Deep Ink (contemporary depth, NOT old-map navy)
  p: '#0F2540',          // deep ink — modern editorial
  pHover: '#081832',
  pLight: '#E3E8EE',
  pDark: '#051428',

  // 시그니처 모먼트 ONLY — Linear single-accent 원칙
  active: '#B0843A',     // muted gold (적용 면적 5% 미만)
  activeLight: '#F4EAD3',

  // semantic — sophisticated muted
  success: '#2E7D5A',
  successLight: '#E1EFE6',
  error: '#9C3A30',      // deeper warm red
  errorLight: '#F4E0DC',
  warning: '#B5803A',    // deeper warm amber
  warningLight: '#F2E8D2',
  info: '#5B7A98',
  infoLight: '#E1E8EF',

  // surface — Apple Books 정합 (less yellow, more modern)
  bg: '#FBFAF6',         // contemporary off-white paper
  bg2: '#F4F0E9',        // page canvas
  bg3: '#ECE6DA',        // page edge fill

  // text — ink (deeper, more refined)
  t1: '#1A1714',
  t2: 'rgba(26, 23, 20, 0.62)',
  t3: 'rgba(26, 23, 20, 0.38)',
  t4: 'rgba(26, 23, 20, 0.20)',
  ti: '#FBFAF6',

  bd: '#E0DBD0',         // subtler hairline (Linear 정합)
  bdf: '#0F2540',
  bde: '#9C3A30',
} as const;

// Dark v06.40 — Reflect/Linear 정합 (warm dark, NOT 순흑)
export const colorsDark = {
  ...colorsLight,
  p: '#6B9BD1',
  pHover: '#87B0DC',
  pLight: 'rgba(107, 155, 209, 0.18)',
  pDark: '#4F84BC',

  active: '#D4A856',
  activeLight: 'rgba(212, 168, 86, 0.18)',
  success: '#5BA47D',
  successLight: 'rgba(91, 164, 125, 0.18)',
  error: '#C25E54',
  errorLight: 'rgba(194, 94, 84, 0.18)',
  warning: '#CEA254',
  warningLight: 'rgba(206, 162, 84, 0.18)',
  info: '#8AA8C0',
  infoLight: 'rgba(138, 168, 192, 0.18)',

  bg: '#231D17',         // card (살짝 lighter warm dark)
  bg2: '#181410',        // canvas
  bg3: '#2D261F',        // fill

  t1: '#F0EAE0',
  t2: 'rgba(240, 234, 224, 0.62)',
  t3: 'rgba(240, 234, 224, 0.38)',
  t4: 'rgba(240, 234, 224, 0.20)',
  ti: '#F0EAE0',

  bd: '#3D362D',
  bdf: '#6B9BD1',
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
