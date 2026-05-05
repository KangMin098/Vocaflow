// apps/web/src/components/pairflip/PairFlipModeSelector.tsx
// 2가지 모드 토글 (word_meaning default · word_definition Phase 2 disabled)

'use client'

import type { PairFlipMode } from './types'

interface ModeSelectorProps {
  selected: PairFlipMode
  onChange: (mode: PairFlipMode) => void
}

const MODES: Array<{ id: PairFlipMode; label: string; description: string; disabled?: boolean }> = [
  { id: 'word_meaning', label: '영단어 ↔ 한글 뜻', description: '기본 모드' },
  {
    id: 'word_definition',
    label: '영단어 ↔ 영영 정의',
    description: '준비 중 (Phase 2)',
    disabled: true,
  },
]

export function PairFlipModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="매칭 모드 선택"
      className="inline-flex items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-1"
    >
      {MODES.map((m) => {
        const isActive = selected === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${m.label} — ${m.description}`}
            disabled={m.disabled}
            onClick={() => !m.disabled && onChange(m.id)}
            className={`min-h-[40px] rounded-[var(--r-sm)] px-4 py-2 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-1 ${
              isActive
                ? 'text-[#FCD34D] shadow-sm [background:linear-gradient(135deg,#1E3A8A_0%,#1E1B4B_100%)]'
                : m.disabled
                  ? 'cursor-not-allowed text-[var(--t3)] opacity-60'
                  : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
            }`}
          >
            {m.label}
            {m.disabled && (
              <span className="ml-1.5 font-mono text-[10px] font-[700] uppercase tracking-wider opacity-70">
                soon
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
