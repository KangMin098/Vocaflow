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
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
