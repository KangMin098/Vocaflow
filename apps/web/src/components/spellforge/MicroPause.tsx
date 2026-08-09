// apps/web/src/components/spellforge/MicroPause.tsx

'use client'

import { useEffect } from 'react'

interface MicroPauseProps {
  visible: boolean
  icon: string
  message: string
  currentIdx: number
  totalCount: number
  accuracy: number
  onSkip: () => void
}

export function MicroPause({
  visible,
  icon,
  message,
  currentIdx,
  totalCount,
  accuracy,
  onSkip,
}: MicroPauseProps) {
  // Space/Enter로 즉시 다음
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        onSkip()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, onSkip])

  return (
    <div
      role="dialog"
      aria-label="정답 확인"
      className={`fixed inset-0 z-[75] flex items-center justify-center bg-[var(--reading-bg)] transition-opacity duration-[var(--dur-slow)] ease-[var(--ease)] ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      } `}
    >
      <div className="max-w-md p-8 text-center">
        <span
          className="mb-4 inline-block animate-[gentle-float_2s_ease-in-out_infinite] text-[48px]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="mb-4 font-english text-[18px] italic leading-relaxed text-[var(--t1)]">
          {message}
        </p>
        <div className="mb-4 inline-flex items-center gap-3.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-mono text-[11px] text-[var(--t2)]">
          <div>
            <span className="font-display text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              단어
            </span>
            <strong className="ml-1 font-[700] text-[var(--t1)]">
              {currentIdx + 1}/{totalCount}
            </strong>
          </div>
          <span className="h-3 w-px bg-[var(--bd)]" />
          <div>
            <span className="font-display text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              정확도
            </span>
            <strong className="ml-1 font-[700] text-[var(--t1)]">{accuracy}%</strong>
          </div>
        </div>
        <p className="font-body text-[11px] italic text-[var(--t2)]">
          <kbd className="mx-0.5 rounded border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]">
            Space
          </kbd>
          또는
          <kbd className="mx-0.5 rounded border border-[var(--bd)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]">
            Enter
          </kbd>
          다음으로
        </p>
      </div>
    </div>
  )
}
