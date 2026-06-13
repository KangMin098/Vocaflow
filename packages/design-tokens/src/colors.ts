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

export const colorsLight = {
  // 브랜드 = Ink Navy (제네릭 system blue 탈출 · 차분한 권위)
  p: '#1E3A5F',          // ink navy
  pHover: '#152A45',
  pLight: '#E5EAF1',     // pale navy tint
  pDark: '#0F1E33',

  active: '#B8893B',     // muted gold (금고/금박 — 보상색)
  activeLight: '#F5EBD4',

  // semantic — paper-tone 채도 하향
  success: '#2E7D5A',    // muted forest green
  successLight: '#E1EFE6',
  error: '#A03A2E',      // warm red
  errorLight: '#F5E1DD',
  warning: '#C68A2C',    // warm amber (gold 계열)
  warningLight: '#F5EBD4',
  info: '#5B7A98',       // dusty blue-gray
  infoLight: '#E1E8EF',

  // surface — paper
  bg: '#FAF8F3',         // warm paper card
  bg2: '#F2EEE6',        // page canvas
  bg3: '#EAE4D8',        // page edge fill

  // text — ink (warm, NOT pure black)
  t1: '#1C1815',                          // ink primary
  t2: 'rgba(28, 24, 21, 0.62)',            // secondary ink
  t3: 'rgba(28, 24, 21, 0.38)',            // tertiary ink
  t4: 'rgba(28, 24, 21, 0.20)',            // quaternary ink
  ti: '#FAF8F3',                          // on-tint = paper

  bd: '#D8D2C2',         // paper hairline
  bdf: '#1E3A5F',        // focused = ink navy
  bde: '#A03A2E',        // error = warm red
} as const;

// Dark — warm ink dark (서재 야간), 순흑 X
export const colorsDark = {
  ...colorsLight,
  p: '#5F8FC0',                              // lighter ink navy (다크 대비)
  pHover: '#7BA3CE',
  pLight: 'rgba(95, 143, 192, 0.18)',
  pDark: '#4A7AAA',

  active: '#D4A856',                         // lighter muted gold
  activeLight: 'rgba(212, 168, 86, 0.18)',
  success: '#5BA47D',
  successLight: 'rgba(91, 164, 125, 0.18)',
  error: '#C8645A',
  errorLight: 'rgba(200, 100, 90, 0.18)',
  warning: '#D4A856',
  warningLight: 'rgba(212, 168, 86, 0.18)',
  info: '#8AA8C0',
  infoLight: 'rgba(138, 168, 192, 0.18)',

  bg: '#1F1A14',         // 카드 (warm dark paper)
  bg2: '#16130E',        // canvas (warm dark, 순흑 X)
  bg3: '#2A241E',        // fill

  t1: '#F0EAE0',
  t2: 'rgba(240, 234, 224, 0.62)',
  t3: 'rgba(240, 234, 224, 0.38)',
  t4: 'rgba(240, 234, 224, 0.20)',
  ti: '#F0EAE0',

  bd: '#3A332B',         // warm hairline dark
  bdf: '#5F8FC0',
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
