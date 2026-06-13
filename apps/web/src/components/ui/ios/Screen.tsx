// apps/web/src/components/ui/ios/Screen.tsx
//
// iOS 화면 셸 — 콘텐츠 폭 variant.
// audit D8 정합: max-w-2xl 단일 고정 → width variant 도입.
//
//  · content (default) — `--ios-content-max` (820px) · 학습 콘텐츠 (Hub/Reader)
//  · wide              — `--ios-content-wide-max` (1024px) · Dashboard · Library Browse
//  · compact           — 580px · 단일 작업 폼 (Diagnostic 문항 등)
//  · full              — 폭 제한 없음 · Admin 표·캘린더 등 전체 폭 필요 화면
//
// 안전 영역: safe-area-inset-left/right 자동 패딩.

import { cn } from '@/lib/utils/cn'
import type { ReactNode } from 'react'

export interface ScreenProps {
  children: ReactNode
  /** 콘텐츠 폭 — content (820) / wide (1024) / compact (580) / full */
  width?: 'content' | 'wide' | 'compact' | 'full'
  /** 캔버스 배경 — bg (흰색) / bg2 (그레이) / transparent (부모 결정) */
  background?: 'bg' | 'bg2' | 'transparent'
  /** 가로 패딩 — sm 12 / md 16 / lg 20 / none */
  padX?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  /** main 태그 사용 (default) → 비활성화 시 div */
  asMain?: boolean
}

const WIDTH_CLASS: Record<NonNullable<ScreenProps['width']>, string> = {
  compact: 'max-w-[580px]',
  content: 'max-w-[var(--ios-content-max)]',
  wide: 'max-w-[var(--ios-content-wide-max)]',
  full: 'max-w-none',
}

const BG_CLASS: Record<NonNullable<ScreenProps['background']>, string> = {
  bg: 'bg-[var(--bg)]',
  bg2: 'bg-[var(--bg2)]',
  transparent: '',
}

const PAD_X: Record<NonNullable<ScreenProps['padX']>, string> = {
  none: '',
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
}

export function Screen({
  children,
  width = 'content',
  background = 'bg2',
  padX = 'md',
  className,
  asMain = true,
}: ScreenProps) {
  const Inner = asMain ? 'main' : 'div'
  return (
    <div
      className={cn(
        'min-h-dvh',
        BG_CLASS[background],
        // safe-area-inset-{left,right}
        'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        className,
      )}
    >
      <Inner className={cn('mx-auto w-full', WIDTH_CLASS[width], PAD_X[padX])}>
        {children}
      </Inner>
    </div>
  )
}
