// apps/web/src/components/flashcard/MicroPause.tsx

'use client'

import type { PauseMessage } from '@/types/flashcard'

interface MicroPauseProps {
  visible: boolean
  message: PauseMessage
  currentIdx: number
  total: number
}

export function MicroPause({ visible, message, currentIdx, total }: MicroPauseProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[75] flex items-center justify-center bg-[var(--reading-bg)] transition-opacity duration-[var(--dur-slow)] ease-[var(--ease)] ${visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} `}
    >
      <div className="max-w-[400px] p-8 text-center">
        <span
          className="mb-4 inline-block animate-[gentle-float_2s_ease-in-out_infinite] text-[48px]"
          aria-hidden="true"
        >
          {message.icon}
        </span>
        <p className="mb-5 font-english text-[18px] italic leading-relaxed text-[var(--t1)]">
          {message.text}
        </p>
        <div className="inline-flex items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-mono text-[12px] font-[500] text-[var(--t2)]">
          <span>
            <strong className="font-[700] text-[var(--t1)]">{currentIdx + 1}</strong>
            {' / '}
            {total} 다음
          </span>
        </div>
      </div>
    </div>
  )
}
