// apps/web/src/app/admin/vrl/_components/DimensionsGrid.tsx
//
// Section 3 — 9 Dimensions 그리드 (3×3 on desktop, 1-col mobile).

import { Sparkles } from 'lucide-react'
import type { DimensionScore } from '@/lib/admin/dict/types'
import { DimensionCard } from './DimensionCard'

interface DimensionsGridProps {
  dimensions: DimensionScore[]
}

export function DimensionsGrid({ dimensions }: DimensionsGridProps) {
  // 가중치 순 정렬 (가중치 큰 차원이 좌상단 — F-pattern 시각 정합)
  const sorted = [...dimensions].sort((a, b) => b.weight - a.weight)

  return (
    <section aria-label="9 quality dimensions" className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
          aria-hidden
        >
          <Sparkles size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
            9 Quality Dimensions
          </h2>
          <p className="font-body text-[12px] text-[var(--t3)]">
            Volume · Coverage · Linguistic · Learning · VRL · Integrity · Pipeline · Freshness · Schema (가중치 합 100%)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((d) => (
          <DimensionCard key={d.id} dimension={d} />
        ))}
      </div>
    </section>
  )
}
