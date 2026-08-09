// apps/web/src/components/wordvault/ScriptsChipNav.tsx
//
// 스크립트 칩 네비게이션 (v06.21.6)
//
// 디자인:
//   [전체 247] [Gatsby 32] [1984 18] [TED 47] [BBC 23] [⭐즐겨찾기 28]
//
// 활성 칩: 인디고 배경 + 흰 텍스트
// 비활성: bg2 + 카운트는 흐리게
// 모바일: 가로 스크롤 (snap-x)

'use client'

import { Library } from 'lucide-react'

export interface ScriptChip {
  id: string
  label: string
  count: number
  /** 칩 색 변형 (예: 즐겨찾기 = amber) — 미지정 시 기본 인디고 */
  accent?: string
}

interface ScriptsChipNavProps {
  chips: ScriptChip[]
  active: string
  onChange: (id: string) => void
}

const DEFAULT_ACCENT = '#6366F1' // indigo (FlowNav 단어 stage 정합)

export function ScriptsChipNav({ chips, active, onChange }: ScriptsChipNavProps) {
  return (
    <div
      role="tablist"
      aria-label="스크립트 필터"
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const isActive = active === chip.id
        const isAll = chip.id === 'all'
        const accent = chip.accent ?? DEFAULT_ACCENT
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(chip.id)}
            className={`group inline-flex h-9 min-h-[36px] shrink-0 snap-start items-center gap-1.5 rounded-[var(--r-full)] px-3.5 font-display text-[13px] font-[600] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isActive
                ? 'text-white shadow-sm'
                : 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--bd-strong)] hover:bg-[var(--bg2)]'
            }`}
            style={
              isActive
                ? {
                    background: `linear-gradient(135deg, ${accent} 0%, ${darken(accent)} 100%)`,
                  }
                : undefined
            }
          >
            {isAll && (
              <Library
                size={12}
                strokeWidth={2.2}
                aria-hidden
                className={isActive ? 'text-white/90' : 'text-[var(--t2)]'}
              />
            )}
            <span className="truncate">{chip.label}</span>
            <span
              className={`inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-[var(--r-full)] px-1.5 font-mono text-[10px] font-[700] tabular-nums ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg2)] text-[var(--t2)] group-hover:text-[var(--t2)]'
              }`}
            >
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// 색상 톤 다운 — 활성 칩 그라디언트용 (단순 hex darken)
function darken(hex: string): string {
  if (!hex.startsWith('#')) return hex
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 0xff) - 32)
  const g = Math.max(0, ((n >> 8) & 0xff) - 32)
  const b = Math.max(0, (n & 0xff) - 32)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
