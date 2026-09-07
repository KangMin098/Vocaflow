// apps/web/src/components/spellforge/ModeSelector.tsx

'use client'

import type { SpellForgeMode } from '@/types/spellforge'

interface ModeSelectorProps {
  mode: SpellForgeMode
  onChange: (mode: SpellForgeMode) => void
}

const MODES: Array<{
  key: SpellForgeMode
  emoji: string
  label: string
  tooltip: string
}> = [
  {
    key: 'delayed',
    emoji: '⌨️',
    label: '기본',
    tooltip: '단어 완성 후 평가 - 학습 효과 ★★★★',
  },
  {
    key: 'realtime',
    emoji: '⚡',
    label: '즉시',
    tooltip: '글자별 즉시 피드백 - 초보자용 ★★★',
  },
  {
    key: 'blind',
    emoji: '🎯',
    label: '도전',
    tooltip: '입력 중 글자 안 보임 - 고급자용 ★★★★★',
  },
]

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="학습 모드 선택"
      className="mb-6 flex gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
    >
      {MODES.map((m) => {
        const isActive = mode === m.key
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            role="radio"
            aria-checked={isActive}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-full)] px-4 py-2 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ${
              isActive
                ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-sm)]'
                : 'bg-transparent text-[var(--t2)] hover:text-[var(--t1)]'
            } `}
          >
            <span className="text-[13px] leading-none" aria-hidden="true">
              {m.emoji}
            </span>
            <span>{m.label}</span>
            <span
              className="relative ml-0.5 inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full bg-[var(--bg3)] font-mono text-[8px] font-[700] text-[var(--t2)] hover:bg-[var(--bd)] hover:text-[var(--t1)]"
              title={m.tooltip}
            >
              i
            </span>
          </button>
        )
      })}
    </div>
  )
}
