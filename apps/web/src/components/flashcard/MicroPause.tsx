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
        {/* v07 — 떠다니는 48px 이모지(무한 반복)를 뺐다. 끝나는 상태가 없는 장식 모션이었다.
            주묵 세로획 하나로 「쉬어 가는 자리」만 표시한다. (`message.icon` 데이터는 그대로 둔다) */}
        <span aria-hidden className="mx-auto mb-5 block h-8 w-[3px] bg-[var(--ju)]" />
        <p className="mb-5 font-editorial text-[19px] leading-relaxed text-[var(--t1)] [word-break:keep-all]">
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
