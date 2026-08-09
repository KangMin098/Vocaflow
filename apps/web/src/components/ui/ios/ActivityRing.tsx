// apps/web/src/components/ui/ios/ActivityRing.tsx
//
// iOS Activity Ring (Fitness 앱 감성).
// 원형 진행도 + 중앙 텍스트. 도달 시 그린 그라데이션 + glow.
//
// 접근성: prefers-reduced-motion 시 SVG stroke-dashoffset transition 0ms 로 즉시 반영.
// (CSS @media 전역 가드가 1차로 잡지만, inline style transition 은 우선순위가 높아
//  CSS guard 가 닿지 않음 → JS 분기로 명시.)

'use client'

import { useId } from 'react'

import { useReduceMotion } from '@/hooks/useReduceMotion'

export interface ActivityRingProps {
  /** 0-100 진행도 */
  pct: number
  /** 도달 여부 (그린 그라디언트 + glow) */
  reached?: boolean
  /** Ring size (px). default 140 */
  size?: number
  /** Stroke width (px). default 14 */
  stroke?: number
  /** Ring color (CSS color). default brand --p */
  color?: string
  /** Track color (CSS color). default --bg3 */
  trackColor?: string
  /** 중앙 위 라벨 (작은 mono) */
  capLabel?: string
  /** 중앙 큰 값 */
  centerValue?: string | number
  /** 중앙 아래 라벨 ("/ 84") */
  centerSub?: string
  /** aria-label */
  ariaLabel?: string
}

export function ActivityRing({
  pct,
  reached = false,
  size = 140,
  stroke = 14,
  color = 'var(--p)',
  trackColor = 'var(--bg3)',
  capLabel,
  centerValue,
  centerSub,
  ariaLabel,
}: ActivityRingProps) {
  const id = useId()
  const reduceMotion = useReduceMotion()
  const r = (size - stroke) / 2
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = circ * (1 - clamped / 100)
  const ringColor = reached ? 'var(--ios-green)' : color
  // iOS system color glow — green(달성) / blue(진행)
  const glow = reached
    ? 'drop-shadow(0 0 8px rgba(52,199,89,0.35))'
    : pct > 0
      ? 'drop-shadow(0 0 8px rgba(88,86,214,0.30))'
      : 'none'

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `${Math.round(clamped)}%`}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden style={{ filter: glow }}>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ringColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${cx}px ${cx}px`,
            transition: reduceMotion
              ? 'none'
              : 'stroke-dashoffset 700ms var(--ease-ios-emphasized)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
        {capLabel && (
          <span className="font-mono text-[9px] font-[700] uppercase tracking-[0.16em] text-[var(--t2)]">
            {capLabel}
          </span>
        )}
        {centerValue != null && (
          <span className="font-display text-[26px] font-[800] leading-none tracking-[-0.025em] tabular-nums text-[var(--t1)]">
            {centerValue}
          </span>
        )}
        {centerSub && (
          <span className="font-mono text-[10.5px] tabular-nums text-[var(--t2)]">
            {centerSub}
          </span>
        )}
      </div>
    </div>
  )
}
