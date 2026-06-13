// apps/web/src/components/ui/ios/Capsule.tsx
//
// iOS Capsule (캡슐 배지) — Health/Stocks/Settings에 흔히 쓰는 작은 정보 칩.
// `label`+`value` 또는 단일 `children` 모드.

import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

export type CapsuleTone =
  | 'neutral'
  | 'brand'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'gray'

export interface CapsuleProps {
  /** label+value 모드: label */
  label?: string
  /** label+value 모드: value */
  value?: string | number
  /** 단일 children 모드 */
  children?: ReactNode
  tone?: CapsuleTone
  size?: 'sm' | 'md'
  className?: string
}

interface ToneStyle {
  bg: string
  label: string
  value: string
}

// 다크 정합 — neutral/gray 캡슐은 캔버스(--bg2 = 다크 순흑)와 겹침 방지 위해 --bg3 사용.
const TONE_STYLES: Record<CapsuleTone, ToneStyle> = {
  neutral: { bg: 'var(--bg3)', label: 'var(--t3)', value: 'var(--t1)' },
  brand: { bg: 'var(--p-light)', label: 'var(--p)', value: 'var(--p)' },
  red: { bg: 'var(--ios-red-tint)', label: 'var(--ios-red)', value: 'var(--ios-red)' },
  orange: { bg: 'var(--ios-orange-tint)', label: 'var(--ios-orange)', value: 'var(--ios-orange)' },
  yellow: { bg: 'var(--ios-yellow-tint)', label: '#92400E', value: '#92400E' },
  green: { bg: 'var(--ios-green-tint)', label: 'var(--ios-green)', value: 'var(--ios-green)' },
  blue: { bg: 'var(--ios-blue-tint)', label: 'var(--ios-blue)', value: 'var(--ios-blue)' },
  purple: { bg: 'var(--ios-purple-tint)', label: 'var(--ios-purple)', value: 'var(--ios-purple)' },
  pink: { bg: 'var(--ios-pink-tint)', label: 'var(--ios-pink)', value: 'var(--ios-pink)' },
  gray: { bg: 'var(--bg3)', label: 'var(--t3)', value: 'var(--t2)' },
}

export function Capsule({
  label,
  value,
  children,
  tone = 'neutral',
  size = 'md',
  className,
}: CapsuleProps) {
  const t = TONE_STYLES[tone]
  const padClass = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-3 py-1 text-[12.5px]'

  if (children) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-ios-pill font-display font-[600]',
          padClass,
          className,
        )}
        style={{ backgroundColor: t.bg, color: t.value }}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-ios-pill',
        padClass,
        className,
      )}
      style={{ backgroundColor: t.bg }}
    >
      {label && (
        <span
          className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.14em]"
          style={{ color: t.label, opacity: 0.85 }}
        >
          {label}
        </span>
      )}
      {value != null && (
        <span
          className="font-display font-[600] tabular-nums"
          style={{ color: t.value, fontSize: size === 'sm' ? '11px' : '12.5px' }}
        >
          {value}
        </span>
      )}
    </span>
  )
}
