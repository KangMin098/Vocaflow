// packages/design-tokens/src/motion.ts
export const duration = {
  fast: 100,
  quick: 150,
  normal: 200,
  slow: 300,
  slower: 500,
  // DD-65 — 반복(무한) 모션 한 바퀴
  loopFast: 2000,
  loop: 4000,
  loopSlow: 30000,
} as const;

export const easing = {
  default: 'cubic-bezier(.4, 0, .2, 1)',
  in: 'cubic-bezier(.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, .2, 1)',
  spring: 'cubic-bezier(.34, 1.56, .64, 1)',
  outQuint: 'cubic-bezier(.22, 1, .36, 1)',
} as const;

export type DurationKey = keyof typeof duration;
export type EasingKey = keyof typeof easing;
