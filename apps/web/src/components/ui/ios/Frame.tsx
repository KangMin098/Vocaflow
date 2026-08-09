// apps/web/src/components/ui/ios/Frame.tsx
//
// Card + iOS section header pattern.
// HIG: Title (large, font-display, tight tracking) + 선택 meta (캡션) + "More →" 링크.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

import { Card } from './Card'
import type { CardProps } from './Card'

export interface FrameProps extends Omit<CardProps, 'children'> {
  title: string
  /** 작은 보조 텍스트 (캡션). 카운트, 기준 등 */
  meta?: string
  /** 우측 More 링크 (iOS Section header 패턴) */
  moreHref?: string
  moreLabel?: string
  /** 헤더 우측에 임의 노드 (배지 등). moreHref와 동시 사용 가능 */
  headerRight?: ReactNode
  children?: ReactNode
}

export function Frame({
  title,
  meta,
  moreHref,
  moreLabel = '더보기',
  headerRight,
  size = 'lg',
  elevation = 2,
  className,
  children,
  ...rest
}: FrameProps) {
  return (
    <Card size={size} elevation={elevation} className={className} {...rest}>
      {/* Section Header v06.40 — 22px font-[600] (Linear/Things 3 정밀) + 호흡 강화 */}
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[22px] font-[600] tracking-[-0.022em] leading-[1.1] text-[var(--t1)]">
            {title}
          </h2>
          {meta && (
            <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
              {meta}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerRight}
          {moreHref && (
            <Link
              href={moreHref}
              className={cn(
                'inline-flex items-center gap-0.5 font-display text-[14px] font-[600] text-[var(--p)]',
                'transition-colors duration-[var(--dur-ios-fast)] hover:text-[var(--p-hover)]',
              )}
            >
              {moreLabel}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </header>
      {children}
    </Card>
  )
}
