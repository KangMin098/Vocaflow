// apps/web/src/components/ui/ios/InsetGroup.tsx
//
// iOS Settings 인셋 그룹 list 컨테이너.
// rounded-ios-lg (14px) 외곽 + 내부 흰 surface + divide-y.
// 옵션 header (대문자 캡션) + footer 메모.

import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

export interface InsetGroupProps {
  /** 위쪽 캡션 라벨 (대문자 mono) */
  header?: string
  /** 아래쪽 보조 텍스트 (회색 small) */
  footer?: string
  className?: string
  children: ReactNode
}

export function InsetGroup({
  header,
  footer,
  className,
  children,
}: InsetGroupProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {header && (
        <span className="px-1 font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          {header}
        </span>
      )}
      <div className="overflow-hidden rounded-ios-lg bg-[var(--bg2)]">
        <div className="divide-y divide-[var(--bd)]/60 bg-[var(--bg)]">
          {children}
        </div>
      </div>
      {footer && (
        <span className="px-1 font-body text-[11.5px] text-[var(--t3)]">
          {footer}
        </span>
      )}
    </div>
  )
}
