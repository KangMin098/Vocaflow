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
// ⚠️ 글자색은 tint 위 AA(4.5:1) 를 넘겨야 한다. iOS 원색(--ios-green 등)을 같은 계열 tint 위에
//    글자로 얹으면 2.0~3.5:1 로 전부 미달이었다(2026-08-09 axe 실측) → *-ink 토큰으로 교체.
//    neutral/gray 라벨도 --t3(0.38 알파)는 어떤 배경에서도 4.5 를 못 넘겨(최대 2.4) --t2 로 올림.
const TONE_STYLES: Record<CapsuleTone, ToneStyle> = {
  neutral: { bg: 'var(--bg3)', label: 'var(--t2)', value: 'var(--t1)' },
  brand: { bg: 'var(--p-light)', label: 'var(--on-p-tint)', value: 'var(--on-p-tint)' },
  red: { bg: 'var(--ios-red-tint)', label: 'var(--ios-red-ink)', value: 'var(--ios-red-ink)' },
  orange: { bg: 'var(--ios-orange-tint)', label: 'var(--ios-orange-ink)', value: 'var(--ios-orange-ink)' },
  yellow: { bg: 'var(--ios-yellow-tint)', label: 'var(--ios-yellow-ink)', value: 'var(--ios-yellow-ink)' },
  green: { bg: 'var(--ios-green-tint)', label: 'var(--ios-green-ink)', value: 'var(--ios-green-ink)' },
  blue: { bg: 'var(--ios-blue-tint)', label: 'var(--ios-blue-ink)', value: 'var(--ios-blue-ink)' },
  purple: { bg: 'var(--ios-purple-tint)', label: 'var(--ios-purple-ink)', value: 'var(--ios-purple-ink)' },
  pink: { bg: 'var(--ios-pink-tint)', label: 'var(--ios-pink-ink)', value: 'var(--ios-pink-ink)' },
  gray: { bg: 'var(--bg3)', label: 'var(--t2)', value: 'var(--t2)' },
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
  const padClass = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1 text-[13px]'

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
        'inline-flex items-baseline gap-2 rounded-ios-pill',
        padClass,
        className,
      )}
      style={{ backgroundColor: t.bg }}
    >
      {label && (
        <span
          // opacity 0.85 를 덧씌우면 색 토큰이 확보한 대비가 다시 깎인다(이중 감광) → 제거.
          className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em]"
          style={{ color: t.label }}
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
