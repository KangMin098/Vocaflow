// apps/web/src/components/ui/ios/InsetRow.tsx
//
// iOS Settings 셀 — InsetGroup 내부 행.
// 좌측 SF Symbol 컬러 사각형 아이콘 + title + subtitle + 우측 chevron / 메타.

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export interface InsetRowProps {
  /** Link 모드 — 빠지면 div */
  href?: string
  /** Icon (lucide / 임의) — 흰색 위에 표시되도록 자동 처리 */
  icon?: ReactNode
  /** Icon container 배경색 (CSS color). 없으면 ios-blue */
  iconBg?: string
  /** Primary text */
  title: string
  /** Secondary text (작은 회색) */
  subtitle?: string
  /** 우측 라벨 (메타) — chevron 앞에 표시 */
  metaRight?: string
  /** 우측 chevron 숨김 (info-only row) */
  hideChevron?: boolean
  /** 진도 막대 (0~1). subtitle 아래 표시 */
  progress?: { done: number; total: number; unit?: string }
  /** 외부 클릭 핸들러 (button 모드) */
  onClick?: () => void
  className?: string
}

export function InsetRow({
  href,
  icon,
  iconBg = 'var(--ios-blue)',
  title,
  subtitle,
  metaRight,
  hideChevron = false,
  progress,
  onClick,
  className,
}: InsetRowProps) {
  const inner = (
    <>
      {icon && (
        <span
          aria-hidden
          // iOS Settings icon container — 12px continuous, larger SF Symbol weight
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-ios-md text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-1 font-display text-[15px] font-[500] tracking-[-0.012em] text-[var(--t1)] group-hover:text-[var(--p)]">
          {title}
        </span>
        {(subtitle || (progress && progress.total > 0)) && (
          <div className="flex items-center gap-2">
            {subtitle && (
              <span className="line-clamp-1 font-body text-[11.5px] text-[var(--t3)]">
                {subtitle}
              </span>
            )}
            {progress && progress.total > 0 && (
              <span className="shrink-0 rounded-ios-pill bg-[var(--bg2)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--t2)]">
                {progress.done}/{progress.total}
                {progress.unit ?? ''}
              </span>
            )}
          </div>
        )}
        {progress && progress.total > 0 && (
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--bg3)]">
            <div
              className="h-full rounded-full transition-[width] duration-[var(--dur-ios-slow)] ease-ios-standard"
              style={{
                width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                backgroundColor:
                  progress.done >= progress.total ? 'var(--ios-green)' : 'var(--p)',
              }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {metaRight && (
          <span className="font-display text-[15px] font-[400] tabular-nums text-[var(--t2)]">
            {metaRight}
          </span>
        )}
        {!hideChevron && (
          /* iOS disclosure chevron — 정확한 시스템 그레이 */
          <ChevronRight
            size={17}
            strokeWidth={2.25}
            className="text-[rgba(60,60,67,0.30)] dark:text-[rgba(235,235,245,0.30)]"
            aria-hidden
          />
        )}
      </div>
    </>
  )

  const cls = cn(
    /* iOS Settings cell — 최소 44pt 높이 보장 + 16pt edge padding */
    'group flex min-h-[44px] items-center gap-3 px-4 py-2.5',
    'transition-colors duration-[var(--dur-ios-fast)]',
    (href || onClick) && 'hover:bg-[var(--bg2)] active:bg-[var(--bg3)]',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'w-full text-left')}>
        {inner}
      </button>
    )
  }

  return <div className={cls}>{inner}</div>
}
