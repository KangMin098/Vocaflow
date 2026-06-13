// apps/web/src/components/ui/ios/GlassBar.tsx
//
// iOS Glass NavigationBar / Toolbar — 글라스 sticky 헤더.
// UIVisualEffectView.systemMaterial 정합. height = ios-navbar (52px).
// 슬롯: leading / title / trailing.

import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

export interface GlassBarProps {
  /** 좌측 영역 (제목·뒤로가기 등) */
  leading?: ReactNode
  /** 중앙 영역 (세그먼트·검색 등) */
  center?: ReactNode
  /** 우측 영역 (액션 버튼) */
  trailing?: ReactNode
  /** 글라스 강도 — thin / regular / thick. default regular */
  material?: 'thin' | 'regular' | 'thick'
  /** 하단 border 표시 (default true). 일부 페이지에서 끄는 경우 사용 */
  showBorder?: boolean
  /** sticky / fixed. default sticky */
  position?: 'sticky' | 'fixed'
  className?: string
}

const MATERIAL_BG: Record<NonNullable<GlassBarProps['material']>, string> = {
  thin: 'bg-[var(--mat-glass-bg-thin)]',
  regular: 'bg-[var(--mat-glass-bg-regular)]',
  thick: 'bg-[var(--mat-glass-bg-thick)]',
}

export function GlassBar({
  leading,
  center,
  trailing,
  material = 'regular',
  showBorder = true,
  position = 'sticky',
  className,
}: GlassBarProps) {
  return (
    <header
      className={cn(
        position === 'sticky' ? 'sticky top-0' : 'fixed inset-x-0 top-0',
        'z-50 flex h-[var(--ios-navbar-h)] items-center gap-3 px-5',
        '[backdrop-filter:var(--mat-glass-filter)]',
        '[-webkit-backdrop-filter:var(--mat-glass-filter)]',
        MATERIAL_BG[material],
        showBorder && 'border-b border-[var(--bd)]/60',
        className,
      )}
    >
      {leading && <div className="flex items-center gap-3">{leading}</div>}
      {!center && <div className="flex-1" />}
      {center && (
        <>
          <div className="flex-1" />
          <div className="flex items-center justify-center">{center}</div>
          <div className="flex-1" />
        </>
      )}
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </header>
  )
}
