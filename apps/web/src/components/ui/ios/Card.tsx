// apps/web/src/components/ui/ios/Card.tsx
//
// iOS Card — 떠있는 흰 surface (그레이 캔버스 위).
// HIG: continuous-corner radius 24px + soft shadow + 충분한 inner padding.

import { cn } from '@/lib/utils/cn'
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Card size: sm=18px / md=20px / lg=24px / xl=28px inner padding. Default md */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Elevation level (shadow strength). Default 2 */
  elevation?: 1 | 2 | 3 | 4
  /** Semantic landmark tag. Default 'section' */
  as?: 'section' | 'article' | 'div'
  /** Interactive card — hover elevation lift + active scale (iOS spring) */
  interactive?: boolean
  children: ReactNode
}

const SIZE_PAD: Record<NonNullable<CardProps['size']>, string> = {
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-7',
  xl: 'p-7 md:p-8',
}

const ELEVATION: Record<NonNullable<CardProps['elevation']>, string> = {
  1: 'shadow-ios-1',
  2: 'shadow-ios-2',
  3: 'shadow-ios-3',
  4: 'shadow-ios-4',
}

export function Card({
  size = 'md',
  elevation = 2,
  as = 'section',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = as
  return (
    <Tag
      className={cn(
        'rounded-ios-2xl bg-[var(--bg)]',
        SIZE_PAD[size],
        ELEVATION[elevation],
        // iOS spring: tap에서 살짝 줄어들고 hover에 elevation 한 단계 올라옴
        interactive &&
          'motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:ease-ios-emphasized motion-safe:hover:shadow-ios-3 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99] motion-safe:active:translate-y-0 cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
