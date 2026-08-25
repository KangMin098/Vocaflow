// apps/web/src/components/flashcard/RecallPhase.tsx

'use client'

import { Brain } from 'lucide-react'

interface RecallPhaseProps {
  visible: boolean
  progress: number // 0 ~ 100
  label: string // "머리 속에서 뜻을 떠올려보세요" / "떠올리셨나요?"
}

export function RecallPhase({ visible, progress, label }: RecallPhaseProps) {
  return (
    <div
      className={`mb-6 flex h-8 w-full flex-col items-center justify-center transition-opacity duration-[var(--dur-slow)] ease-[var(--ease)] ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'} `}
      aria-live="polite"
    >
      <p className="mb-1.5 flex items-center gap-2 font-display text-[11px] font-[600] uppercase tracking-[0.10em] text-[var(--p)]">
        <Brain size={11} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </p>

      <div className="relative h-[3px] w-[200px] overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]">
        <div
          className="absolute left-0 top-0 h-full rounded-[var(--r-full)] bg-gradient-to-r from-[var(--p)] to-[var(--p-dark)] transition-[width] duration-[100ms] ease-linear"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
