// apps/web/src/components/admin/vcb/preview/VcbCefrDistributionBar.tsx

import { AlertCircle } from 'lucide-react'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR_LEVELS)[number]

const CEFR_COLORS: Record<Cefr, string> = {
  A1: 'var(--cefr-a1)',
  A2: 'var(--cefr-a2)',
  B1: 'var(--cefr-b1)',
  B2: 'var(--cefr-b2)',
  C1: 'var(--cefr-c1)',
  C2: 'var(--cefr-c2)',
}

interface Props {
  distribution: Record<string, number>
  total: number
  specRange: string[]
}

export function VcbCefrDistributionBar({ distribution, total, specRange }: Props) {
  const specSet = new Set(specRange)

  return (
    <div className="flex flex-col gap-3">
      {/* Bar */}
      <div
        className="flex h-3 rounded-[var(--r-full)] overflow-hidden"
        style={{ background: 'var(--bg3)' }}
        role="img"
        aria-label={`CEFR distribution: ${CEFR_LEVELS.map((l) => `${l}=${distribution[l] ?? 0}`).join(', ')}`}
      >
        {CEFR_LEVELS.map((level) => {
          const count = distribution[level] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          const inSpec = specSet.has(level)
          if (count === 0) return null
          return (
            <div
              key={level}
              style={{
                width: `${pct}%`,
                background: inSpec ? CEFR_COLORS[level] : 'var(--t4)',
                opacity: inSpec ? 1 : 0.55,
              }}
              title={`${level}: ${count} (${pct.toFixed(1)}%)${inSpec ? '' : ' — spec 외'}`}
            />
          )
        })}
      </div>

      {/* Legend (6 cells fixed) */}
      <div className="grid grid-cols-6 gap-2">
        {CEFR_LEVELS.map((level) => {
          const count = distribution[level] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          const inSpec = specSet.has(level)
          const isEmpty = count === 0
          return (
            <div
              key={level}
              className="flex flex-col gap-1 px-2 py-2 rounded-[var(--r-md)] border"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--bd)',
                opacity: isEmpty ? 0.6 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: inSpec ? CEFR_COLORS[level] : 'var(--t4)',
                  }}
                />
                <span
                  className="font-mono text-[11px] font-semibold"
                  style={{ color: 'var(--t2)' }}
                >
                  {level}
                </span>
                {!inSpec && !isEmpty && (
                  <AlertCircle
                    className="w-3 h-3"
                    style={{ color: 'var(--warning)' }}
                    aria-label="spec 외"
                  />
                )}
              </div>
              <div className="font-display font-semibold text-sm" style={{ color: 'var(--t1)' }}>
                {count}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--t3)' }}>
                {pct.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
