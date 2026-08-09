// apps/web/src/components/ui/ios/PrimaryButton.tsx
//
// iOS Primary CTA — 큰 캡슐 버튼.
// Tone별 색 (neutral / brand / critical / warning / info / success).
// 좌측 라벨 + (선택) 우측 카운트 배지 + ChevronRight.

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export type PrimaryButtonTone =
  | 'neutral'
  | 'brand'
  | 'critical'
  | 'warning'
  | 'info'
  | 'success'

export interface PrimaryButtonProps {
  /** Link 모드 — 빠지면 button */
  href?: string
  /** onClick (button 모드) */
  onClick?: () => void
  /** 본문 라벨 */
  children: ReactNode
  /** 우측 카운트 배지 (작은 캡슐) */
  count?: number
  /** 우측 아이콘 (default ArrowRight). null 로 숨김 */
  rightIcon?: ReactNode | null
  /** 색상 tone */
  tone?: PrimaryButtonTone
  /** 가로 폭 채우기 */
  block?: boolean
  /** size — sm: 14px 폰트, md: 15px, lg: 16px. default md */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
}

interface ToneStyle {
  bg: string
  text: string
  hoverBg: string
  glow: string
}

const TONE: Record<PrimaryButtonTone, ToneStyle> = {
  neutral: {
    bg: 'bg-[var(--t1)]',
    text: 'text-[var(--bg)]',
    hoverBg: 'hover:bg-[var(--p)]',
    glow: '',
  },
  brand: {
    bg: 'bg-[var(--p)]',
    text: 'text-[var(--on-semantic)]',
    hoverBg: 'hover:bg-[var(--p-hover)]',
    glow: 'shadow-ios-glow-tint',
  },
  // 채움 위 흰 글자는 4.5:1 을 넘겨야 한다 — iOS 원색(red 3.55 · orange 2.20 · green 2.22)은
  //   전부 미달이었다(2026-08-09 axe 실측). Reading Room semantic 팔레트(더 깊은 톤)로 교체하고,
  //   앰버처럼 밝은 면에는 흰 글자 대신 잉크 글자를 얹는다(#231a09 on --warning = 5.00).
  critical: {
    bg: 'bg-[var(--error)]',
    text: 'text-[var(--on-semantic)]',
    hoverBg: 'hover:brightness-95',
    glow: 'shadow-ios-glow-red',
  },
  warning: {
    bg: 'bg-[var(--warning)]',
    text: 'text-[#231a09]',
    hoverBg: 'hover:brightness-95',
    glow: 'shadow-ios-glow-orange',
  },
  info: {
    bg: 'bg-[var(--info)]',
    text: 'text-[var(--on-semantic)]',
    hoverBg: 'hover:brightness-95',
    glow: 'shadow-ios-glow-blue',
  },
  success: {
    bg: 'bg-[var(--success)]',
    text: 'text-[var(--on-semantic)]',
    hoverBg: 'hover:brightness-95',
    glow: 'shadow-ios-glow-green',
  },
}

const SIZE: Record<NonNullable<PrimaryButtonProps['size']>, { font: string; pad: string }> = {
  sm: { font: 'text-[13px]', pad: 'px-4 py-2.5' },
  md: { font: 'text-[15px]', pad: 'px-5 py-4' },
  lg: { font: 'text-[16px]', pad: 'px-6 py-5' },
}

export function PrimaryButton({
  href,
  onClick,
  children,
  count,
  rightIcon,
  tone = 'brand',
  block = true,
  size = 'md',
  className,
  disabled = false,
}: PrimaryButtonProps) {
  const t = TONE[tone]
  const s = SIZE[size]

  const baseCls = cn(
    'inline-flex items-center justify-between gap-3 rounded-ios-xl',
    'font-display font-[600]',
    'transition-all duration-[var(--dur-ios-normal)] ease-ios-standard',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    block && 'w-full',
    s.font,
    s.pad,
    t.bg,
    t.text,
    t.hoverBg,
    t.glow,
    className,
  )

  const inner = (
    <>
      <span>{children}</span>
      {(count != null && count > 0) || rightIcon !== null ? (
        <span className="flex items-center gap-2">
          {count != null && count > 0 && (
            <span className="rounded-ios-pill bg-white/20 px-2.5 py-0.5 font-mono text-[12px] tabular-nums">
              {count}
            </span>
          )}
          {rightIcon === undefined ? <ArrowRight size={16} aria-hidden /> : rightIcon}
        </span>
      ) : null}
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={baseCls}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={baseCls}>
      {inner}
    </button>
  )
}
