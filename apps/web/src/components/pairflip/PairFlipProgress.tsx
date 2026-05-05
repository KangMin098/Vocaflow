// apps/web/src/components/pairflip/PairFlipProgress.tsx
// 하단 진행바 — 매칭된 쌍 비율

'use client'

interface ProgressProps {
  matchedPairs: number
  totalPairs: number
}

export function PairFlipProgress({ matchedPairs, totalPairs }: ProgressProps) {
  const pct = Math.round((matchedPairs / totalPairs) * 100)

  return (
    <footer
      className="flex h-[50px] shrink-0 items-center gap-3 border-t border-[var(--bd)] bg-[var(--bg)] px-4 md:px-6"
      role="status"
      aria-label={`진행도 ${matchedPairs} / ${totalPairs} 쌍`}
    >
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--r-full)] transition-[width] duration-[600ms] ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)',
          }}
          role="progressbar"
          aria-valuenow={matchedPairs}
          aria-valuemin={0}
          aria-valuemax={totalPairs}
        />
      </div>
      <span className="font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
        {matchedPairs}
        <span className="font-mono text-[12px] font-[600] text-[var(--t3)]">/{totalPairs}</span>
        <span className="ml-1 font-display text-[11px] font-[600] text-[var(--t3)]">쌍</span>
      </span>
    </footer>
  )
}
