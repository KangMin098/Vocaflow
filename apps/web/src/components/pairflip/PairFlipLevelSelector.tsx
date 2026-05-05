// apps/web/src/components/pairflip/PairFlipLevelSelector.tsx
// 5단계 난이도 v2 — editorial 골드/네이비 active 상태

'use client'

import { PAIRFLIP_LEVELS } from './constants'
import { PF_COLORS } from './theme'
import type { PairFlipLevel } from './types'

interface LevelSelectorProps {
  selected: PairFlipLevel
  onChange: (level: PairFlipLevel) => void
}

export function PairFlipLevelSelector({ selected, onChange }: LevelSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="난이도 선택"
      className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] md:grid md:grid-cols-5 md:gap-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {PAIRFLIP_LEVELS.map((lvl) => {
        const isActive = selected === lvl.id
        return (
          <button
            key={lvl.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${lvl.label} — ${lvl.description}, 카드 ${lvl.cardCount}장`}
            onClick={() => onChange(lvl.id)}
            className={`group flex min-h-[100px] min-w-[100px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] border-[1.5px] px-3 py-3 transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 active:scale-95 ${
              isActive
                ? 'border-transparent text-[var(--ti)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:-translate-y-0.5 hover:border-[#F59E0B]/50 hover:shadow-md'
            }`}
            style={
              isActive
                ? {
                    background: `linear-gradient(135deg, ${PF_COLORS.coverFrom} 0%, ${PF_COLORS.coverMid} 100%)`,
                    transform: 'translateY(-4px)',
                    boxShadow: `0 0 0 1px ${PF_COLORS.gold}, 0 12px 28px rgba(15, 23, 42, 0.25)`,
                  }
                : undefined
            }
          >
            <span className="text-[24px] leading-none" aria-hidden="true">
              {lvl.emoji}
            </span>
            <span
              className="font-display text-[14px] font-[700] leading-none"
              style={isActive ? { color: PF_COLORS.goldLight } : undefined}
            >
              {lvl.label}
            </span>
            <span
              className={`font-mono text-[11px] font-[600] tabular-nums ${
                isActive ? 'opacity-90' : 'text-[var(--t3)]'
              }`}
            >
              {lvl.cardCount}장
            </span>
          </button>
        )
      })}
    </div>
  )
}
