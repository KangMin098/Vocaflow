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
        {/* v07 — 떠다니는 48px 이모지(무한 반복)를 뺐다 — flashcard/MicroPause 와 같은 판단 */}
        <span aria-hidden className="mx-auto mb-5 block h-8 w-[3px] bg-[var(--ju)]" />
        <p className="mb-4 font-english text-[18px] italic leading-relaxed text-[var(--t1)]">
          {message}
        </p>
        <div className="mb-4 inline-flex items-center gap-4 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-mono text-[11px] text-[var(--t2)]">
          <div>
            <span className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
              단어
            </span>
            <strong className="ml-1 font-[700] text-[var(--t1)]">
              {currentIdx + 1}/{totalCount}
            </strong>
          </div>
          <span className="h-3 w-px bg-[var(--bd)]" />
          <div>
            <span className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
              정확도
            </span>
            <strong className="ml-1 font-[700] text-[var(--t1)]">{accuracy}%</strong>
          </div>
        </div>
        <p className="font-body text-[11px] italic text-[var(--t2)]">
          <kbd className="mx-0.5 rounded border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]">
            Space
          </kbd>
          또는
          <kbd className="mx-0.5 rounded border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]">
            Enter
          </kbd>
          다음으로
        </p>
      </div>
    </div>
  )
}
