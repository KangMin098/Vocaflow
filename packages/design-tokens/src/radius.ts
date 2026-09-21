// packages/design-tokens/src/radius.ts
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  // DD-65 — 웹 --r-3xl…6xl 과 같은 이름·값 (위 sm…2xl 은 웹 v07 램프 2–6px 와 원래부터 다르다)
  '3xl': 8,
  '4xl': 12,
  '5xl': 16,
  '6xl': 24,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
