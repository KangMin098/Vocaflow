// apps/web/src/components/wordvault/hub/TrendIndicator.tsx
//
// TrendIndicator — week-over-week 추세 (MemoryDecayDistribution 헤더 우측)
// CLAUDE.md §17.2 — 자산 변화 가시화 (자기효능감 + Implicit Progress)
//
// Calm UI 정합:
//   - stableDelta > 0 → 초록 ▲ (긍정)
//   - stableDelta < 0 → 회색 ▼ (감쇠 — 빨강 X)
//   - riskDelta < 0  → 초록 ▼ (위급 감소 = 긍정)
//   - riskDelta > 0  → 주황 ▲ (주의 — 빨강 X · §"안티패턴" 압박 회피)
//   - 둘 다 0 → null

import { ArrowDown, ArrowUp } from 'lucide-react'

interface TrendIndicatorProps {
  /** 이번 주 stable 단어 수 - 지난 주 stable 단어 수 */
  stableDelta: number
  /** 이번 주 risk 단어 수 - 지난 주 risk 단어 수 */
  riskDelta: number
}

interface Item {
  label: string
  value: number
  /** Calm UI — positive change 여부 */
  positive: boolean
}

export function TrendIndicator({ stableDelta, riskDelta }: TrendIndicatorProps) {
  if (stableDelta === 0 && riskDelta === 0) return null

  const items: Item[] = []
  if (stableDelta !== 0) {
    items.push({ label: '안정', value: stableDelta, positive: stableDelta > 0 })
  }
  if (riskDelta !== 0) {
    // risk 감소 = positive
    items.push({ label: '위급', value: riskDelta, positive: riskDelta < 0 })
  }

  return (
    <div className="flex items-center gap-2.5" aria-label="이번 주 추세">
      {items.map((item) => {
        const Arrow = item.value > 0 ? ArrowUp : ArrowDown
        const colorClass = item.positive
          ? 'text-[var(--memory-stable)]'
          : item.label === '위급'
            ? 'text-[var(--active)]' // risk 증가 = 주황 (빨강 X)
            : 'text-[var(--t3)]' // stable 감소 = 회색 (Calm UI)
        return (
          <span
            key={item.label}
            className={`inline-flex items-center gap-0.5 font-body text-[11px] font-[600] tabular-nums ${colorClass}`}
          >
            <Arrow size={11} strokeWidth={2.5} aria-hidden="true" />
            {item.value > 0 ? '+' : ''}
            {item.value} {item.label}
          </span>
        )
      })}
    </div>
  )
}
