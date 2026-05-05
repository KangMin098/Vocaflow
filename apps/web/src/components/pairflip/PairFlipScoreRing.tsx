// apps/web/src/components/pairflip/PairFlipScoreRing.tsx
// SVG 원형 진행 링 — 정확도 시각화

'use client'

interface ScoreRingProps {
  accuracy: number // 0~100
  score: number
  size?: number
}

export function PairFlipScoreRing({ accuracy, score, size = 120 }: ScoreRingProps) {
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference * (1 - accuracy / 100)

  const progressColor =
    accuracy >= 90
      ? 'url(#pf-ring-rainbow)'
      : accuracy >= 70
        ? '#F59E0B'
        : accuracy >= 40
          ? '#06B6D4'
          : 'var(--t3)'

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`정확도 ${accuracy}%, 총 점수 ${score}점`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="pf-ring-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--bg3)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[32px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {accuracy}%
        </span>
        <span className="mt-0.5 font-body text-[12px] font-[600] text-[var(--t3)]">
          {score.toLocaleString()}점
        </span>
      </div>
    </div>
  )
}
