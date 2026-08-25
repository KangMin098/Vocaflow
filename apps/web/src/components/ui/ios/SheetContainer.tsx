// apps/web/src/components/ui/ios/SheetContainer.tsx
//
// iOS bottom sheet — Modal Presentation 정합.
// 핵심 정합:
//   · keyframe 은 globals.css §4.5 의 sheetUp (전역). styled-jsx 스코프 회피.
//   · backdrop = solid scrim (블러 X — RN Material 바와 중복 비용 차단).
//   · ESC 키 / scrim 클릭으로 닫힘.
//   · reduce-motion 시 transition 사실상 0 (전역 @media 가드).
//   · 안전 영역: safe-bottom (env(safe-area-inset-bottom)).
//
// detent: medium (50dvh) | large (90dvh).

'use client'

import { useEffect } from 'react'

import { cn } from '@/lib/utils/cn'
import { useReduceMotion } from '@/hooks/useReduceMotion'

export interface SheetContainerProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  detent?: 'medium' | 'large'
  /** aria-labelledby 대상 ID (시트 내 제목 element id). 없으면 aria-label 사용 */
  labelledBy?: string
  /** aria-label fallback */
  ariaLabel?: string
  /** scrim 클릭 닫힘 비활성 (확인 필요한 critical 모달) */
  disableBackdropClose?: boolean
}

export function SheetContainer({
  visible,
  onClose,
  children,
  detent = 'medium',
  labelledBy,
  ariaLabel = '시트',
  disableBackdropClose = false,
}: SheetContainerProps) {
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // body scroll lock
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [visible, onClose])

  if (!visible) return null

  const heightClass = detent === 'large' ? 'h-[90dvh]' : 'h-[50dvh]'
  const sheetAnim = reduceMotion
    ? ''
    : 'animate-[sheetUp_280ms_var(--ease-ios-emphasized)]'
  const scrimAnim = reduceMotion
    ? ''
    : 'animate-[scrimFadeIn_200ms_var(--ease-ios-standard)]'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labelledBy ? undefined : ariaLabel}
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-[200]"
    >
      {/* scrim — solid (블러 X) */}
      <button
        type="button"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-label="시트 닫기"
        tabIndex={disableBackdropClose ? -1 : 0}
        className={cn(
          'absolute inset-0 bg-[rgba(15,23,42,0.4)]',
          scrimAnim,
          disableBackdropClose && 'cursor-default',
        )}
      />

      {/* sheet */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0',
          heightClass,
          'rounded-t-ios-2xl bg-[var(--bg)] shadow-ios-4',
          'flex flex-col',
          // safe area bottom
          'pb-[env(safe-area-inset-bottom)]',
          sheetAnim,
        )}
      >
        {/* grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <span
            aria-hidden
            className="h-[5px] w-9 rounded-ios-pill bg-[var(--t4)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>
  )
}
