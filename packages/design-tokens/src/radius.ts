// packages/design-tokens/src/radius.ts
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radius;
