// apps/web/src/components/spellforge/ModeSelector.tsx

'use client'

import type { SpellForgeMode } from '@/types/spellforge'

interface ModeSelectorProps {
  mode: SpellForgeMode
  onChange: (mode: SpellForgeMode) => void
}

const MODES: Array<{
  key: SpellForgeMode
  /** 난이도 눈금(1~3) — 이모지 대신 칸 수가 말한다(v07 §3-5 아이콘·자산). */
  bars: number
  label: string
  tooltip: string
}> = [
  {
    key: 'delayed',
    bars: 2,
    label: '기본',
    tooltip: '단어 완성 후 평가 - 학습 효과 ★★★★',
  },
  {
    key: 'realtime',
    bars: 1,
    label: '즉시',
    tooltip: '글자별 즉시 피드백 - 초보자용 ★★★',
  },
  {
    key: 'blind',
    bars: 3,
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
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--r-full)] px-4 py-2 font-display text-[12px] font-[600] transition-[background-color,color] duration-[var(--dur-fast)] ${
              isActive
                ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-sm)]'
                : 'bg-transparent text-[var(--t2)] hover:text-[var(--t1)]'
            } `}
          >
            {/* v07 — 이모지(⌨️ ⚡ 🎯)를 뺐다. 기기마다 다른 그림이 나오므로 **우리가 고른
                얼굴이 아니고**, 난이도는 툴팁의 ★ 가 이미 말한다. 칸 수가 대신 말한다. */}
            <span aria-hidden="true" className="flex items-end gap-[2px]">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`block w-[3px] rounded-[1px] ${i <= m.bars ? 'bg-current' : 'bg-[var(--t4)]'}`}
                  style={{ height: 5 + i * 2 }}
                />
              ))}
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
